const { pool } = require('../src/config/db');

async function check() {
  const [roles] = await pool.query('SELECT * FROM roles');
  console.log('ROLES:', roles);

  const [perms] = await pool.query('SELECT * FROM permissions');
  console.log('\nPERMISSIONS:', perms);

  const [rolePerms] = await pool.query(`
    SELECT r.name as role_name, p.name as perm_name 
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    JOIN permissions p ON rp.permission_id = p.id
    ORDER BY r.name, p.name
  `);
  console.log('\nROLE PERMISSIONS COUNT:', rolePerms.length);
  const byRole = {};
  for (const rp of rolePerms) {
    if (!byRole[rp.role_name]) byRole[rp.role_name] = [];
    byRole[rp.role_name].push(rp.perm_name);
  }
  console.log(JSON.stringify(byRole, null, 2));

  await pool.end();
}

check().catch(console.error);
