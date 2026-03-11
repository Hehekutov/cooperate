const { join } = require('node:path');

const {
  ACTIVE_IDEA_STATUSES,
  ARCHIVE_IDEA_STATUSES,
  IDEA_MONTHLY_LIMIT,
  IDEA_STATUSES,
  ROLES,
  SESSION_TTL_HOURS,
  VOTE_APPROVAL_PERCENT
} = require('./constants');
const {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized
} = require('./errors');
const {
  createId,
  generateToken,
  hashPassword,
  normalizePhone,
  verifyPassword
} = require('./auth');
const { FileStore } = require('../store/file-store');

function cleanRequiredString(value, fieldName, maxLength) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw badRequest(`${fieldName} is required`);
  }

  if (text.length > maxLength) {
    throw badRequest(`${fieldName} must be at most ${maxLength} characters`);
  }

  return text;
}

function cleanOptionalString(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw badRequest(`${fieldName} must be at most ${maxLength} characters`);
  }

  return text;
}

function sanitizeCompany(company) {
  return {
    id: company.id,
    name: company.name,
    description: company.description,
    createdAt: company.createdAt,
    settings: company.settings
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    companyId: user.companyId,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    position: user.position,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

function cleanupExpiredSessions(state, nowIso) {
  const now = new Date(nowIso).getTime();

  state.sessions = state.sessions.filter((session) => {
    return new Date(session.expiresAt).getTime() > now;
  });
}

function findCompanyOrThrow(state, companyId) {
  const company = state.companies.find((entry) => entry.id === companyId);

  if (!company) {
    throw notFound('Company was not found');
  }

  return company;
}

function findUserOrThrow(state, userId) {
  const user = state.users.find((entry) => entry.id === userId);

  if (!user) {
    throw notFound('User was not found');
  }

  return user;
}

function findIdeaOrThrow(state, companyId, ideaId) {
  const idea = state.ideas.find((entry) => {
    return entry.id === ideaId && entry.companyId === companyId;
  });

  if (!idea) {
    throw notFound('Idea was not found');
  }

  return idea;
}

function getVoteStats(state, idea) {
  const votes = state.votes.filter((vote) => vote.ideaId === idea.id);
  const supportingVotes = votes.filter((vote) => vote.value === 'for').length;
  const againstVotes = votes.length - supportingVotes;
  const eligibleVoters = idea.votingEligibleUserIds.length;
  const approvalPercent = eligibleVoters
    ? Math.round((supportingVotes / eligibleVoters) * 100)
    : 0;

  return {
    support: supportingVotes,
    against: againstVotes,
    total: votes.length,
    eligibleVoters,
    remainingVotes: Math.max(eligibleVoters - votes.length, 0),
    approvalPercent,
    thresholdPercent: VOTE_APPROVAL_PERCENT,
    passed: approvalPercent > VOTE_APPROVAL_PERCENT
  };
}

function buildAvailableActions(state, idea, viewer) {
  const viewerVote = state.votes.find((vote) => {
    return vote.ideaId === idea.id && vote.userId === viewer.id;
  });

  return {
    canModerate:
      (viewer.role === ROLES.ADMIN || viewer.role === ROLES.DIRECTOR) &&
      idea.status === IDEA_STATUSES.PENDING_MODERATION,
    canVote:
      viewer.role !== ROLES.DIRECTOR &&
      idea.status === IDEA_STATUSES.VOTING &&
      idea.votingEligibleUserIds.includes(viewer.id) &&
      !viewerVote,
    canMakeDirectorDecision:
      viewer.role === ROLES.DIRECTOR &&
      idea.status === IDEA_STATUSES.DIRECTOR_REVIEW
  };
}

function buildIdeaPayload(state, idea, viewer) {
  const author = state.users.find((user) => user.id === idea.authorId) ?? null;
  const moderator = idea.moderatedBy
    ? state.users.find((user) => user.id === idea.moderatedBy) ?? null
    : null;
  const director = idea.directorDecisionBy
    ? state.users.find((user) => user.id === idea.directorDecisionBy) ?? null
    : null;
  const viewerVote = viewer
    ? state.votes.find((vote) => vote.ideaId === idea.id && vote.userId === viewer.id) ?? null
    : null;
  const votes = getVoteStats(state, idea);

  return {
    id: idea.id,
    companyId: idea.companyId,
    title: idea.title,
    description: idea.description,
    descriptionPreview:
      idea.description.length > 200
        ? `${idea.description.slice(0, 197)}...`
        : idea.description,
    status: idea.status,
    scope: ACTIVE_IDEA_STATUSES.has(idea.status) ? 'active' : 'archive',
    archived: ARCHIVE_IDEA_STATUSES.has(idea.status),
    author: author ? sanitizeUser(author) : null,
    moderation: {
      reviewedBy: moderator ? sanitizeUser(moderator) : null,
      comment: idea.moderationComment,
      reviewedAt: idea.moderatedAt
    },
    votes,
    viewerVote: viewerVote
      ? {
          value: viewerVote.value,
          createdAt: viewerVote.createdAt
        }
      : null,
    directorDecision: {
      decidedBy: director ? sanitizeUser(director) : null,
      comment: idea.directorComment,
      decidedAt: idea.directorDecisionAt,
      approved: idea.directorDecisionAt
        ? idea.status === IDEA_STATUSES.APPROVED_BY_DIRECTOR
        : null
    },
    timeline: {
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
      moderatedAt: idea.moderatedAt,
      votingOpenedAt: idea.votingOpenedAt,
      votingClosedAt: idea.votingClosedAt,
      directorReviewRequestedAt: idea.directorReviewRequestedAt,
      directorDecisionAt: idea.directorDecisionAt,
      archivedAt: idea.archivedAt
    },
    availableActions: viewer
      ? buildAvailableActions(state, idea, viewer)
      : {
          canModerate: false,
          canVote: false,
          canMakeDirectorDecision: false
        }
  };
}

function buildCompanyStats(state, companyId) {
  const ideas = state.ideas.filter((idea) => idea.companyId === companyId);
  const activeEmployees = state.users.filter((user) => {
    return user.companyId === companyId && user.isActive;
  });

  return {
    employees: activeEmployees.length,
    ideas: {
      total: ideas.length,
      active: ideas.filter((idea) => ACTIVE_IDEA_STATUSES.has(idea.status)).length,
      archive: ideas.filter((idea) => ARCHIVE_IDEA_STATUSES.has(idea.status)).length,
      pendingModeration: ideas.filter(
        (idea) => idea.status === IDEA_STATUSES.PENDING_MODERATION
      ).length,
      waitingForDirector: ideas.filter(
        (idea) => idea.status === IDEA_STATUSES.DIRECTOR_REVIEW
      ).length
    }
  };
}

function createSession(state, userId, nowIso, sessionTtlHours) {
  const expiresAt = new Date(
    new Date(nowIso).getTime() + sessionTtlHours * 60 * 60 * 1000
  ).toISOString();

  const session = {
    id: createId('session'),
    userId,
    token: generateToken(),
    createdAt: nowIso,
    expiresAt
  };

  state.sessions.push(session);

  return session;
}

function assertCompanyPhoneIsAvailable(state, phone) {
  const existing = state.users.find((user) => user.phone === phone);

  if (existing) {
    throw conflict('A user with this phone number already exists');
  }
}

function assertRoleCanBeCreated(role) {
  const allowedRoles = new Set([ROLES.ADMIN, ROLES.EMPLOYEE]);

  if (!allowedRoles.has(role)) {
    throw badRequest('role must be one of: admin, employee');
  }
}

function isIdeaCreatedInSameUtcMonth(ideaCreatedAt, nowIso) {
  const currentDate = new Date(nowIso);
  const createdDate = new Date(ideaCreatedAt);

  return (
    currentDate.getUTCFullYear() === createdDate.getUTCFullYear() &&
    currentDate.getUTCMonth() === createdDate.getUTCMonth()
  );
}

class AppService {
  constructor(options = {}) {
    this.store =
      options.store ??
      new FileStore(options.dataFile ?? join(process.cwd(), 'data/app-data.json'));
    this.sessionTtlHours = Number(
      options.sessionTtlHours ??
        process.env.SESSION_TTL_HOURS ??
        SESSION_TTL_HOURS
    );
    this.ideaMonthlyLimit = Number(
      options.ideaMonthlyLimit ??
        process.env.IDEA_MONTHLY_LIMIT ??
        IDEA_MONTHLY_LIMIT
    );
  }

  async initialize() {
    await this.store.ensure();
  }

  async registerCompany(input) {
    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      cleanupExpiredSessions(state, nowIso);

      const companyName = cleanRequiredString(input.companyName, 'companyName', 120);
      const description = cleanOptionalString(
        input.companyDescription,
        'companyDescription',
        500
      );
      const directorName = cleanRequiredString(input.directorName, 'directorName', 120);
      const position =
        cleanOptionalString(input.directorPosition, 'directorPosition', 120) ?? 'Director';
      const phone = normalizePhone(input.phone);
      const passwordHash = hashPassword(input.password);

      assertCompanyPhoneIsAvailable(state, phone);

      const company = {
        id: createId('company'),
        name: companyName,
        description,
        createdAt: nowIso,
        settings: {
          ideaMonthlyLimit: this.ideaMonthlyLimit,
          voteApprovalPercent: VOTE_APPROVAL_PERCENT
        }
      };

      const director = {
        id: createId('user'),
        companyId: company.id,
        fullName: directorName,
        phone,
        role: ROLES.DIRECTOR,
        position,
        avatarUrl: cleanOptionalString(input.avatarUrl, 'avatarUrl', 500),
        passwordHash,
        isActive: true,
        createdAt: nowIso
      };

      state.companies.push(company);
      state.users.push(director);

      const session = createSession(state, director.id, nowIso, this.sessionTtlHours);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        company: sanitizeCompany(company),
        user: sanitizeUser(director)
      };
    });
  }

  async login(input) {
    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      cleanupExpiredSessions(state, nowIso);

      const phone = normalizePhone(input.phone);
      const password = String(input.password ?? '');
      const user = state.users.find((entry) => entry.phone === phone && entry.isActive);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw unauthorized('Invalid phone number or password');
      }

      const session = createSession(state, user.id, nowIso, this.sessionTtlHours);
      const company = findCompanyOrThrow(state, user.companyId);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        company: sanitizeCompany(company),
        user: sanitizeUser(user)
      };
    });
  }

  async logout(token) {
    await this.store.update((state) => {
      state.sessions = state.sessions.filter((session) => session.token !== token);
    });
  }

  async getContextByToken(token) {
    if (!token) {
      return null;
    }

    const state = await this.store.getState();
    const now = Date.now();
    const session = state.sessions.find((entry) => {
      return entry.token === token && new Date(entry.expiresAt).getTime() > now;
    });

    if (!session) {
      return null;
    }

    const user = state.users.find((entry) => entry.id === session.userId && entry.isActive);

    if (!user) {
      return null;
    }

    const company = state.companies.find((entry) => entry.id === user.companyId);

    if (!company) {
      return null;
    }

    return {
      company: sanitizeCompany(company),
      user: sanitizeUser(user)
    };
  }

  async getCompanyOverview(actor) {
    const state = await this.store.getState();
    const company = findCompanyOrThrow(state, actor.companyId);

    return {
      company: sanitizeCompany(company),
      currentUser: actor,
      stats: buildCompanyStats(state, actor.companyId)
    };
  }

  async listEmployees(actor) {
    const state = await this.store.getState();
    const roleOrder = {
      [ROLES.DIRECTOR]: 0,
      [ROLES.ADMIN]: 1,
      [ROLES.EMPLOYEE]: 2
    };

    const items = state.users
      .filter((user) => user.companyId === actor.companyId && user.isActive)
      .sort((left, right) => {
        return (
          roleOrder[left.role] - roleOrder[right.role] ||
          left.fullName.localeCompare(right.fullName)
        );
      })
      .map(sanitizeUser);

    return {
      items,
      total: items.length
    };
  }

  async addEmployee(actor, input) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw forbidden('Only the director can add employees');
    }

    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      const company = findCompanyOrThrow(state, actor.companyId);

      const role = String(input.role ?? '').trim();
      const fullName = cleanRequiredString(input.fullName, 'fullName', 120);
      const phone = normalizePhone(input.phone);
      const position =
        cleanOptionalString(input.position, 'position', 120) ?? 'Employee';
      const avatarUrl = cleanOptionalString(input.avatarUrl, 'avatarUrl', 500);
      const passwordHash = hashPassword(input.password);

      assertRoleCanBeCreated(role);
      assertCompanyPhoneIsAvailable(state, phone);

      const user = {
        id: createId('user'),
        companyId: company.id,
        fullName,
        phone,
        role,
        position,
        avatarUrl,
        passwordHash,
        isActive: true,
        createdAt: nowIso
      };

      state.users.push(user);

      return sanitizeUser(user);
    });
  }

  async createIdea(actor, input) {
    if (actor.role === ROLES.DIRECTOR) {
      throw forbidden('The director cannot create ideas');
    }

    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      const title = cleanRequiredString(input.title, 'title', 160);
      const description = cleanRequiredString(input.description, 'description', 3000);
      const currentMonthIdeas = state.ideas.filter((idea) => {
        return (
          idea.authorId === actor.id &&
          idea.companyId === actor.companyId &&
          isIdeaCreatedInSameUtcMonth(idea.createdAt, nowIso)
        );
      });

      if (currentMonthIdeas.length >= this.ideaMonthlyLimit) {
        throw conflict(
          `Monthly limit reached: only ${this.ideaMonthlyLimit} ideas are allowed per user`
        );
      }

      const idea = {
        id: createId('idea'),
        companyId: actor.companyId,
        authorId: actor.id,
        title,
        description,
        status: IDEA_STATUSES.PENDING_MODERATION,
        moderationComment: null,
        moderatedAt: null,
        moderatedBy: null,
        votingEligibleUserIds: [],
        votingOpenedAt: null,
        votingClosedAt: null,
        directorReviewRequestedAt: null,
        directorDecisionAt: null,
        directorDecisionBy: null,
        directorComment: null,
        archivedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      state.ideas.push(idea);

      return buildIdeaPayload(state, idea, actor);
    });
  }

  async listIdeas(actor, query = {}) {
    const state = await this.store.getState();
    const scope = String(query.scope ?? 'active');
    const statusFilter = query.status ? String(query.status) : null;
    const searchQuery = String(query.q ?? '').trim().toLowerCase();
    const limit = query.limit ? Number(query.limit) : null;
    const sort = String(query.sort ?? 'recent');

    let ideas = state.ideas.filter((idea) => idea.companyId === actor.companyId);

    if (scope === 'active') {
      ideas = ideas.filter((idea) => ACTIVE_IDEA_STATUSES.has(idea.status));
    } else if (scope === 'archive') {
      ideas = ideas.filter((idea) => ARCHIVE_IDEA_STATUSES.has(idea.status));
    } else if (scope === 'mine') {
      ideas = ideas.filter((idea) => idea.authorId === actor.id);
    } else if (scope === 'moderation') {
      ideas = ideas.filter((idea) => idea.status === IDEA_STATUSES.PENDING_MODERATION);
    } else if (scope === 'director_review') {
      ideas = ideas.filter((idea) => idea.status === IDEA_STATUSES.DIRECTOR_REVIEW);
    } else if (scope !== 'all') {
      throw badRequest('scope must be one of: active, archive, mine, moderation, director_review, all');
    }

    if (statusFilter) {
      ideas = ideas.filter((idea) => idea.status === statusFilter);
    }

    if (searchQuery) {
      ideas = ideas.filter((idea) => {
        return (
          idea.title.toLowerCase().includes(searchQuery) ||
          idea.description.toLowerCase().includes(searchQuery)
        );
      });
    }

    let items = ideas.map((idea) => buildIdeaPayload(state, idea, actor));

    if (sort === 'support') {
      items = items.sort((left, right) => {
        return (
          right.votes.approvalPercent - left.votes.approvalPercent ||
          new Date(right.timeline.updatedAt).getTime() -
            new Date(left.timeline.updatedAt).getTime()
        );
      });
    } else {
      items = items.sort((left, right) => {
        return (
          new Date(right.timeline.updatedAt).getTime() -
          new Date(left.timeline.updatedAt).getTime()
        );
      });
    }

    if (Number.isInteger(limit) && limit > 0) {
      items = items.slice(0, limit);
    }

    return {
      items,
      total: items.length
    };
  }

  async getIdea(actor, ideaId) {
    const state = await this.store.getState();
    const idea = findIdeaOrThrow(state, actor.companyId, ideaId);

    return buildIdeaPayload(state, idea, actor);
  }

  async moderateIdea(actor, ideaId, input) {
    if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.DIRECTOR) {
      throw forbidden('Only an admin or the director can moderate ideas');
    }

    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      const idea = findIdeaOrThrow(state, actor.companyId, ideaId);

      if (idea.status !== IDEA_STATUSES.PENDING_MODERATION) {
        throw conflict('Only ideas awaiting moderation can be reviewed');
      }

      idea.moderatedBy = actor.id;
      idea.moderatedAt = nowIso;
      idea.moderationComment = cleanOptionalString(input.comment, 'comment', 1000);
      idea.updatedAt = nowIso;

      if (input.approved) {
        idea.status = IDEA_STATUSES.VOTING;
        idea.votingOpenedAt = nowIso;
        idea.votingEligibleUserIds = state.users
          .filter((user) => {
            return (
              user.companyId === actor.companyId &&
              user.isActive &&
              user.role !== ROLES.DIRECTOR
            );
          })
          .map((user) => user.id);

        if (idea.votingEligibleUserIds.length === 0) {
          idea.status = IDEA_STATUSES.DIRECTOR_REVIEW;
          idea.votingClosedAt = nowIso;
          idea.directorReviewRequestedAt = nowIso;
        }
      } else {
        idea.status = IDEA_STATUSES.REJECTED_BY_ADMIN;
        idea.archivedAt = nowIso;
        idea.votingEligibleUserIds = [];
      }

      return buildIdeaPayload(state, idea, actor);
    });
  }

  async voteIdea(actor, ideaId, input) {
    if (actor.role === ROLES.DIRECTOR) {
      throw forbidden('The director does not participate in employee voting');
    }

    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      const idea = findIdeaOrThrow(state, actor.companyId, ideaId);
      const value = String(input.value ?? '').trim();

      if (idea.status !== IDEA_STATUSES.VOTING) {
        throw conflict('Voting is not open for this idea');
      }

      if (!idea.votingEligibleUserIds.includes(actor.id)) {
        throw forbidden('You are not eligible to vote on this idea');
      }

      if (value !== 'for' && value !== 'against') {
        throw badRequest('value must be one of: for, against');
      }

      const existingVote = state.votes.find((vote) => {
        return vote.ideaId === idea.id && vote.userId === actor.id;
      });

      if (existingVote) {
        throw conflict('You have already voted for this idea');
      }

      state.votes.push({
        id: createId('vote'),
        ideaId: idea.id,
        userId: actor.id,
        value,
        createdAt: nowIso
      });

      const votes = getVoteStats(state, idea);

      if (votes.approvalPercent > VOTE_APPROVAL_PERCENT) {
        idea.status = IDEA_STATUSES.DIRECTOR_REVIEW;
        idea.votingClosedAt = nowIso;
        idea.directorReviewRequestedAt = nowIso;
      } else if (votes.total >= votes.eligibleVoters) {
        idea.status = IDEA_STATUSES.REJECTED_BY_VOTE;
        idea.votingClosedAt = nowIso;
        idea.archivedAt = nowIso;
      }

      idea.updatedAt = nowIso;

      return buildIdeaPayload(state, idea, actor);
    });
  }

  async makeDirectorDecision(actor, ideaId, input) {
    if (actor.role !== ROLES.DIRECTOR) {
      throw forbidden('Only the director can make the final decision');
    }

    return this.store.update((state) => {
      const nowIso = new Date().toISOString();
      const idea = findIdeaOrThrow(state, actor.companyId, ideaId);

      if (idea.status !== IDEA_STATUSES.DIRECTOR_REVIEW) {
        throw conflict('Only ideas waiting for the director can be finalized');
      }

      idea.directorDecisionAt = nowIso;
      idea.directorDecisionBy = actor.id;
      idea.directorComment = cleanOptionalString(input.comment, 'comment', 1000);
      idea.archivedAt = nowIso;
      idea.updatedAt = nowIso;
      idea.status = input.approved
        ? IDEA_STATUSES.APPROVED_BY_DIRECTOR
        : IDEA_STATUSES.REJECTED_BY_DIRECTOR;

      return buildIdeaPayload(state, idea, actor);
    });
  }
}

module.exports = {
  AppService,
  buildCompanyStats,
  buildIdeaPayload,
  findCompanyOrThrow,
  findIdeaOrThrow,
  findUserOrThrow,
  sanitizeCompany,
  sanitizeUser
};
