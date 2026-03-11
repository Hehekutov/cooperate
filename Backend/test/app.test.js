const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { createApp } = require('../src/app');

async function buildTestApp() {
  const directory = await mkdtemp(join(tmpdir(), 'cooperate-backend-'));
  const dataFile = join(directory, 'app-data.json');
  const app = await createApp({ logger: false, dataFile });

  return {
    app,
    async cleanup() {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function request(app, options) {
  const response = await app.inject(options);
  const payload = response.body ? JSON.parse(response.body) : null;

  return {
    statusCode: response.statusCode,
    payload
  };
}

test('it enforces the monthly idea limit and completes the approval flow', async () => {
  const { app, cleanup } = await buildTestApp();

  try {
    const register = await request(app, {
      method: 'POST',
      url: '/api/auth/register-company',
      payload: {
        companyName: 'Acme',
        directorName: 'Director One',
        phone: '+70000000011',
        password: 'director123'
      }
    });

    assert.equal(register.statusCode, 201);
    const directorToken = register.payload.data.token;

    const createAdmin = await request(app, {
      method: 'POST',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${directorToken}`
      },
      payload: {
        fullName: 'Admin One',
        phone: '+70000000012',
        password: 'admin123',
        role: 'admin',
        position: 'Administrator'
      }
    });

    assert.equal(createAdmin.statusCode, 201);

    const createEmployee = await request(app, {
      method: 'POST',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${directorToken}`
      },
      payload: {
        fullName: 'Employee One',
        phone: '+70000000013',
        password: 'employee123',
        role: 'employee',
        position: 'Developer'
      }
    });

    assert.equal(createEmployee.statusCode, 201);

    const adminLogin = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        phone: '+70000000012',
        password: 'admin123'
      }
    });

    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.payload.data.token;

    const employeeLogin = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        phone: '+70000000013',
        password: 'employee123'
      }
    });

    assert.equal(employeeLogin.statusCode, 200);
    const employeeToken = employeeLogin.payload.data.token;

    const createdIdeas = [];

    for (let index = 1; index <= 3; index += 1) {
      const response = await request(app, {
        method: 'POST',
        url: '/api/ideas',
        headers: {
          authorization: `Bearer ${employeeToken}`
        },
        payload: {
          title: `Idea ${index}`,
          description: `Description ${index}`
        }
      });

      assert.equal(response.statusCode, 201);
      createdIdeas.push(response.payload.data);
    }

    const fourthIdea = await request(app, {
      method: 'POST',
      url: '/api/ideas',
      headers: {
        authorization: `Bearer ${employeeToken}`
      },
      payload: {
        title: 'Idea 4',
        description: 'Description 4'
      }
    });

    assert.equal(fourthIdea.statusCode, 409);
    assert.equal(fourthIdea.payload.error.code, 'CONFLICT');

    const moderate = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createdIdeas[0].id}/moderate`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        approved: true,
        comment: 'Looks good'
      }
    });

    assert.equal(moderate.statusCode, 200);
    assert.equal(moderate.payload.data.status, 'voting');

    const employeeVote = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createdIdeas[0].id}/vote`,
      headers: {
        authorization: `Bearer ${employeeToken}`
      },
      payload: {
        value: 'for'
      }
    });

    assert.equal(employeeVote.statusCode, 200);
    assert.equal(employeeVote.payload.data.status, 'voting');
    assert.equal(employeeVote.payload.data.votes.approvalPercent, 50);

    const adminVote = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createdIdeas[0].id}/vote`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        value: 'for'
      }
    });

    assert.equal(adminVote.statusCode, 200);
    assert.equal(adminVote.payload.data.status, 'director_review');

    const finalDecision = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createdIdeas[0].id}/decision`,
      headers: {
        authorization: `Bearer ${directorToken}`
      },
      payload: {
        approved: true,
        comment: 'Go ahead'
      }
    });

    assert.equal(finalDecision.statusCode, 200);
    assert.equal(finalDecision.payload.data.status, 'approved_by_director');

    const archive = await request(app, {
      method: 'GET',
      url: '/api/ideas?scope=archive',
      headers: {
        authorization: `Bearer ${employeeToken}`
      }
    });

    assert.equal(archive.statusCode, 200);
    assert.equal(archive.payload.data.total, 1);
    assert.equal(archive.payload.data.items[0].status, 'approved_by_director');
  } finally {
    await cleanup();
  }
});

test('it archives an idea when all eligible votes are cast and support is too low', async () => {
  const { app, cleanup } = await buildTestApp();

  try {
    const register = await request(app, {
      method: 'POST',
      url: '/api/auth/register-company',
      payload: {
        companyName: 'Beta',
        directorName: 'Director Two',
        phone: '+70000000021',
        password: 'director123'
      }
    });

    const directorToken = register.payload.data.token;

    await request(app, {
      method: 'POST',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${directorToken}`
      },
      payload: {
        fullName: 'Admin Two',
        phone: '+70000000022',
        password: 'admin123',
        role: 'admin',
        position: 'Administrator'
      }
    });

    await request(app, {
      method: 'POST',
      url: '/api/employees',
      headers: {
        authorization: `Bearer ${directorToken}`
      },
      payload: {
        fullName: 'Employee Two',
        phone: '+70000000023',
        password: 'employee123',
        role: 'employee',
        position: 'Developer'
      }
    });

    const adminLogin = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        phone: '+70000000022',
        password: 'admin123'
      }
    });

    const employeeLogin = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        phone: '+70000000023',
        password: 'employee123'
      }
    });

    const createIdea = await request(app, {
      method: 'POST',
      url: '/api/ideas',
      headers: {
        authorization: `Bearer ${employeeLogin.payload.data.token}`
      },
      payload: {
        title: 'Unpopular idea',
        description: 'This one should fail the vote.'
      }
    });

    assert.equal(createIdea.statusCode, 201);

    const moderate = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createIdea.payload.data.id}/moderate`,
      headers: {
        authorization: `Bearer ${adminLogin.payload.data.token}`
      },
      payload: {
        approved: true
      }
    });

    assert.equal(moderate.statusCode, 200);

    const employeeVote = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createIdea.payload.data.id}/vote`,
      headers: {
        authorization: `Bearer ${employeeLogin.payload.data.token}`
      },
      payload: {
        value: 'against'
      }
    });

    assert.equal(employeeVote.statusCode, 200);
    assert.equal(employeeVote.payload.data.status, 'voting');

    const adminVote = await request(app, {
      method: 'POST',
      url: `/api/ideas/${createIdea.payload.data.id}/vote`,
      headers: {
        authorization: `Bearer ${adminLogin.payload.data.token}`
      },
      payload: {
        value: 'against'
      }
    });

    assert.equal(adminVote.statusCode, 200);
    assert.equal(adminVote.payload.data.status, 'rejected_by_vote');

    const archivedIdea = await request(app, {
      method: 'GET',
      url: `/api/ideas/${createIdea.payload.data.id}`,
      headers: {
        authorization: `Bearer ${directorToken}`
      }
    });

    assert.equal(archivedIdea.statusCode, 200);
    assert.equal(archivedIdea.payload.data.archived, true);
    assert.equal(archivedIdea.payload.data.status, 'rejected_by_vote');
  } finally {
    await cleanup();
  }
});
