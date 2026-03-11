const { join } = require('node:path');

const { AppService } = require('./lib/app-service');
const { ROLES } = require('./lib/constants');
const { createInitialState } = require('./store/file-store');

async function seed() {
  const dataFile = process.env.DATA_FILE ?? join(process.cwd(), 'data/app-data.json');
  const service = new AppService({ dataFile });

  await service.initialize();
  await service.store.setState(createInitialState());

  const directorAuth = await service.registerCompany({
    companyName: 'OOO Tmyv',
    companyDescription: 'Internal idea and voting platform demo company',
    directorName: 'Ivan Perevichkov',
    directorPosition: 'Director',
    phone: '+70000000001',
    password: 'director123'
  });

  const admin = await service.addEmployee(directorAuth.user, {
    fullName: 'Sofia Kolbasenko',
    phone: '+70000000002',
    password: 'admin123',
    role: ROLES.ADMIN,
    position: 'Office Administrator'
  });

  const backendEngineer = await service.addEmployee(directorAuth.user, {
    fullName: 'Nikolai Pusanov',
    phone: '+70000000003',
    password: 'employee123',
    role: ROLES.EMPLOYEE,
    position: 'Backend Engineer'
  });

  const analyst = await service.addEmployee(directorAuth.user, {
    fullName: 'Ivan Lavrentiev',
    phone: '+70000000004',
    password: 'employee123',
    role: ROLES.EMPLOYEE,
    position: 'Business Analyst'
  });

  const adminAuth = await service.login({
    phone: admin.phone,
    password: 'admin123'
  });
  const backendAuth = await service.login({
    phone: backendEngineer.phone,
    password: 'employee123'
  });
  const analystAuth = await service.login({
    phone: analyst.phone,
    password: 'employee123'
  });

  const coffeeIdea = await service.createIdea(backendAuth.user, {
    title: 'Install a coffee machine',
    description:
      'Employees spend too much time leaving the office for coffee. A shared coffee machine would be cheaper and faster.'
  });

  await service.moderateIdea(adminAuth.user, coffeeIdea.id, {
    approved: true,
    comment: 'The request is clearly written and can move to voting.'
  });
  await service.voteIdea(backendAuth.user, coffeeIdea.id, { value: 'for' });
  await service.voteIdea(adminAuth.user, coffeeIdea.id, { value: 'for' });
  await service.makeDirectorDecision(directorAuth.user, coffeeIdea.id, {
    approved: true,
    comment: 'Approved for the next office budget cycle.'
  });

  const passIdea = await service.createIdea(analystAuth.user, {
    title: 'Create a badge request app',
    description:
      'Couriers and guests create too much manual work. A badge request app would save time for the office team.'
  });

  await service.moderateIdea(adminAuth.user, passIdea.id, {
    approved: true,
    comment: 'Good request, ready for company voting.'
  });
  await service.voteIdea(analystAuth.user, passIdea.id, { value: 'against' });
  await service.voteIdea(adminAuth.user, passIdea.id, { value: 'against' });
  await service.voteIdea(backendAuth.user, passIdea.id, { value: 'for' });

  const foodIdea = await service.createIdea(backendAuth.user, {
    title: 'Free lunch support',
    description:
      'A lunch stipend could reduce daily employee costs and improve satisfaction.'
  });

  await service.moderateIdea(adminAuth.user, foodIdea.id, {
    approved: true,
    comment: 'Text is fine, sending to voting.'
  });
  await service.voteIdea(backendAuth.user, foodIdea.id, { value: 'for' });
  await service.voteIdea(adminAuth.user, foodIdea.id, { value: 'for' });
  await service.makeDirectorDecision(directorAuth.user, foodIdea.id, {
    approved: false,
    comment: 'Rejected because the budget is not available this quarter.'
  });

  const styleIdea = await service.createIdea(analystAuth.user, {
    title: 'Rewrite request form copy',
    description:
      'The text contains slang and should be rewritten before it can be published for voting.'
  });

  await service.moderateIdea(adminAuth.user, styleIdea.id, {
    approved: false,
    comment: 'Please rewrite the request in clear business language.'
  });

  await service.createIdea(backendAuth.user, {
    title: 'Buy PlayStation 5 for the rest area',
    description:
      'A shared console in the break area could improve morale and be used during internal events.'
  });

  console.log(`Seed completed: ${dataFile}`);
  console.log('Director: +70000000001 / director123');
  console.log('Admin:    +70000000002 / admin123');
  console.log('Employee: +70000000003 / employee123');
  console.log('Employee: +70000000004 / employee123');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
