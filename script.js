// ═══════════════════════════════════════════════════════════════
//  NEXABANK BANKING SIMULATOR — script.js
//  Full-featured banking system with persistent localStorage
// ═══════════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────────────
let DB = {
  users: [],
  transactions: [],
  loans: [],
  logs: [],
  notifications: [],
  fraudAlerts: [],
  simDate: new Date().toISOString(),
  initialized: false,
  settings: { simSpeed: 1, theme: 'light', autoSim: false }
};

let currentUser = null;
let currentRole = null; // 'admin' | 'user'
let currentPage = 'dashboard';
let simInterval = null;
let simDate = new Date();
let simSpeedMultiplier = 1;
let notifCount = 0;
let tableState = {};

// ─── CONSTANTS ────────────────────────────────────────────────────
const FIRST_NAMES = ['James','Maria','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Susan','Richard','Jessica','Joseph','Sarah','Thomas','Karen','Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Donald','Sandra','Paul','Ashley','Mark','Emily','George','Dorothy','Kevin','Donna','Edward','Carol','Brian','Amanda','Ronald','Melissa','Timothy','Deborah','Jason','Stephanie','Gary','Rebecca','Jeffrey','Sharon','Ryan','Laura','Jacob','Cynthia','Nicholas','Kathleen','Eric','Catherine','Jonathan','Amy','Stephen','Angela','Larry','Shirley','Justin','Anna','Scott','Brenda','Frank','Pamela','Brandon','Emma','Raymond','Virginia','Gregory','Michelle','Samuel','Joyce','Benjamin','Frances','Patrick','Alice','Jack','Jean','Dennis','Diane','Jerry','Judy','Alexander','Christina','Tyler','Julie'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster'];
const STREET_NAMES = ['Main St','Oak Ave','Maple Dr','Cedar Ln','Pine Rd','Elm St','Washington Blvd','Park Ave','Lake Dr','Hill Rd','River Rd','Forest Ave','Sunset Blvd','Highland Ave','Valley Rd'];
const CITIES = ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Indianapolis','Charlotte','San Francisco','Seattle','Denver','Nashville'];
const LOAN_TYPES = ['Personal','Auto','Home Mortgage','Business','Education','Medical','Home Equity'];
const ACCOUNT_TYPES = ['savings','checking','deposit','ewallet'];

// ─── STORAGE ──────────────────────────────────────────────────────
function saveDB() {
  try {
    DB.simDate = simDate.toISOString();
    const data = JSON.stringify(DB);
    localStorage.setItem('nexabank_db', data);
  } catch(e) { console.error('Save failed:', e); }
}

function loadDB() {
  try {
    const data = localStorage.getItem('nexabank_db');
    if (data) {
      DB = JSON.parse(data);
      simDate = new Date(DB.simDate || Date.now());
      return true;
    }
    return false;
  } catch(e) { return false; }
}

function resetDB() {
  localStorage.removeItem('nexabank_db');
  location.reload();
}

// ─── GENERATORS ───────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dec=2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dec)); }
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randBool(prob=0.5) { return Math.random() < prob; }

function genAccountNumber() {
  return 'NXB-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

function genCardNumber() {
  let n = '4';
  for(let i = 0; i < 15; i++) n += randInt(0,9);
  return n.match(/.{1,4}/g).join(' ');
}

function genCVV() { return String(randInt(100, 999)); }

function genExpiry() {
  const m = String(randInt(1, 12)).padStart(2, '0');
  const y = String(randInt(26, 30));
  return `${m}/${y}`;
}

function genId(prefix='TXN') {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + randInt(100,999);
}

function genCreditScore() { return randInt(300, 850); }

function creditTier(score) {
  if(score >= 750) return { label: 'Excellent', color: 'green' };
  if(score >= 700) return { label: 'Good', color: 'blue' };
  if(score >= 650) return { label: 'Fair', color: 'orange' };
  return { label: 'Poor', color: 'red' };
}

function genUser(index) {
  const firstName = randItem(FIRST_NAMES);
  const lastName = randItem(LAST_NAMES);
  const accNum = genAccountNumber();
  const creditScore = genCreditScore();
  const status = randBool(0.85) ? 'Active' : (randBool(0.5) ? 'Locked' : 'Suspended');
  const joinDate = new Date(Date.now() - randInt(1, 1095) * 86400000);
  const lastLogin = new Date(joinDate.getTime() + randInt(0, (Date.now() - joinDate.getTime())));

  const tags = [];
  if(creditScore >= 750) tags.push('VIP');
  if(creditScore < 500) tags.push('Risky');
  if(randBool(0.1)) tags.push('Fraud Watch');

  const accounts = {
    savings: {
      type: 'savings',
      balance: randFloat(500, 50000),
      interestRate: randFloat(1.5, 4.5),
      transactions: []
    },
    checking: {
      type: 'checking',
      balance: randFloat(200, 15000),
      interestRate: randFloat(0.1, 0.5),
      transactions: []
    },
    deposit: {
      type: 'deposit',
      balance: randFloat(5000, 200000),
      interestRate: randFloat(4.0, 7.5),
      maturityDate: new Date(Date.now() + randInt(30, 730) * 86400000).toISOString(),
      transactions: []
    },
    ewallet: {
      type: 'ewallet',
      balance: randFloat(0, 5000),
      interestRate: 0,
      transactions: []
    }
  };

  const card = {
    number: genCardNumber(),
    expiry: genExpiry(),
    cvv: genCVV(),
    linkedAccount: 'checking',
    active: status === 'Active'
  };

  return {
    id: 'USR-' + String(index).padStart(5, '0'),
    accountNumber: accNum,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
    phone: `+1-${randInt(200,999)}-${randInt(100,999)}-${randInt(1000,9999)}`,
    password: 'pass123',
    address: `${randInt(100,9999)} ${randItem(STREET_NAMES)}, ${randItem(CITIES)}`,
    creditScore,
    status,
    kycStatus: randBool(0.9) ? 'Verified' : 'Pending',
    createdAt: joinDate.toISOString(),
    lastLogin: lastLogin.toISOString(),
    failedLogins: 0,
    tags,
    accounts,
    card,
    loanIds: [],
    riskLevel: randBool(0.7) ? 'Low' : (randBool(0.5) ? 'Medium' : 'High')
  };
}

function genLoan(user) {
  const type = randItem(LOAN_TYPES);
  const principal = randFloat(1000, 150000);
  const interestRate = user.creditScore >= 700 ? randFloat(4, 9) : randFloat(10, 24);
  const termMonths = randItem([12, 24, 36, 48, 60, 84, 120]);
  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1+monthlyRate, termMonths)) / (Math.pow(1+monthlyRate, termMonths) - 1);
  const paidMonths = randInt(0, Math.min(termMonths - 1, 24));
  const startDate = new Date(Date.now() - paidMonths * 30 * 86400000);
  const endDate = new Date(startDate.getTime() + termMonths * 30 * 86400000);
  const remainingBalance = principal - (monthlyPayment * paidMonths * 0.7);
  const statuses = ['Active','Paid','Overdue','Restructured'];
  const status = paidMonths === 0 ? 'Active' : randItem(['Active','Active','Active','Overdue','Paid']);

  return {
    id: genId('LN'),
    userId: user.id,
    userAccNum: user.accountNumber,
    userName: user.fullName,
    type,
    principal: parseFloat(principal.toFixed(2)),
    interestRate,
    termMonths,
    monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
    paidMonths,
    remainingBalance: Math.max(0, parseFloat(remainingBalance.toFixed(2))),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status,
    latePenalties: status === 'Overdue' ? randFloat(50, 500) : 0,
    nextPaymentDate: new Date(Date.now() + randInt(1, 30) * 86400000).toISOString(),
    createdAt: startDate.toISOString()
  };
}

function genTransaction(users, type) {
  const user = randItem(users);
  const accTypes = ['savings','checking','ewallet'];
  const accType = randItem(accTypes);
  const amount = randFloat(10, 5000);
  const txTypes = ['Deposit','Withdrawal','Transfer','ATM','Card Payment'];
  const txType = type || randItem(txTypes);

  return {
    id: genId('TXN'),
    userId: user.id,
    userAccNum: user.accountNumber,
    userName: user.fullName,
    accountType: accType,
    type: txType,
    amount: parseFloat(amount.toFixed(2)),
    description: `${txType} - ${accType}`,
    status: randBool(0.95) ? 'Completed' : (randBool(0.5) ? 'Pending' : 'Failed'),
    date: new Date(Date.now() - randInt(0, 30) * 86400000 - randInt(0, 86400000)).toISOString(),
    flagged: randBool(0.05),
    riskScore: randInt(0, 100)
  };
}

function generateInitialData() {
  const users = [];
  const loans = [];
  const transactions = [];

  for(let i = 0; i < 300; i++) {
    const user = genUser(i + 1);
    users.push(user);

    // Assign loans to ~40% of users
    if(randBool(0.4)) {
      const loan = genLoan(user);
      loans.push(loan);
      user.loanIds.push(loan.id);
    }
  }

  // Generate 500 transactions
  for(let i = 0; i < 500; i++) {
    transactions.push(genTransaction(users));
  }

  DB.users = users;
  DB.loans = loans;
  DB.transactions = transactions;
  DB.logs = [];
  DB.notifications = [];
  DB.fraudAlerts = [];
  DB.initialized = true;

  addLog('System', 'system', 'System initialized with 300 users and sample data');
  saveDB();
}

// ─── LOGGING ──────────────────────────────────────────────────────
function addLog(actor, type, message, meta = {}) {
  const log = {
    id: genId('LOG'),
    actor,
    type,
    message,
    meta,
    date: new Date().toISOString()
  };
  DB.logs.unshift(log);
  if(DB.logs.length > 2000) DB.logs = DB.logs.slice(0, 2000);
}

function addNotif(title, message, type = 'info') {
  const notif = {
    id: genId('NTF'),
    title,
    message,
    type,
    date: new Date().toISOString(),
    read: false
  };
  DB.notifications.unshift(notif);
  notifCount++;
  updateNotifBadge();
  renderNotifList();
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if(badge) badge.textContent = notifCount;
}

// ─── TOAST ────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3000) {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ─── LOGIN ────────────────────────────────────────────────────────
let activeLoginTab = 'admin';

function switchLoginTab(tab) {
  activeLoginTab = tab;
  document.querySelectorAll('.ltab').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && tab === 'admin') || (i === 1 && tab === 'user'));
  });
  document.getElementById('adminLoginForm').style.display = tab === 'admin' ? 'block' : 'none';
  document.getElementById('userLoginForm').style.display = tab === 'user' ? 'block' : 'none';
}

function handleLogin() {
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  if(activeLoginTab === 'admin') {
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value.trim();
    if(user === 'admin' && pass === 'admin') {
      currentRole = 'admin';
      currentUser = { id: 'ADMIN', fullName: 'Administrator', accountNumber: 'ADMIN', role: 'admin' };
      addLog('admin', 'login', 'Admin login successful');
      saveDB();
      launchApp();
    } else {
      errEl.textContent = 'Invalid admin credentials.';
      errEl.style.display = 'block';
    }
  } else {
    const accNum = document.getElementById('userAccNum').value.trim().toUpperCase();
    const pass = document.getElementById('userPass').value.trim();
    const user = DB.users.find(u => u.accountNumber === accNum);
    if(!user) {
      errEl.textContent = 'Account number not found.';
      errEl.style.display = 'block';
      return;
    }
    if(user.status === 'Locked') {
      errEl.textContent = 'Account is locked. Contact admin.';
      errEl.style.display = 'block';
      return;
    }
    if(user.password !== pass) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if(user.failedLogins >= 5) {
        user.status = 'Locked';
        addNotif('Account Locked', `${user.fullName}'s account locked after failed attempts`, 'warning');
      }
      saveDB();
      errEl.textContent = `Invalid password. Attempts: ${user.failedLogins}/5`;
      errEl.style.display = 'block';
      return;
    }
    user.failedLogins = 0;
    user.lastLogin = new Date().toISOString();
    currentRole = 'user';
    currentUser = user;
    addLog(user.fullName, 'login', `User login: ${user.accountNumber}`);
    saveDB();
    launchApp();
  }
}

function logout() {
  currentUser = null;
  currentRole = null;
  addLog(currentUser ? currentUser.fullName : 'User', 'logout', 'Logged out');
  saveDB();
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

// ─── APP INIT ─────────────────────────────────────────────────────
function launchApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  buildSidebar();
  updateSidebarUser();
  startClock();
  startSimulation();
  navigateTo('dashboard');
}

function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  const adminNav = [
    { section: 'Overview', items: [
      { icon: '📊', label: 'Dashboard', page: 'dashboard' },
      { icon: '📈', label: 'Analytics', page: 'analytics' }
    ]},
    { section: 'Management', items: [
      { icon: '👥', label: 'Users', page: 'users' },
      { icon: '💳', label: 'Accounts', page: 'accounts' },
      { icon: '💸', label: 'Transactions', page: 'transactions' },
      { icon: '🏦', label: 'Loans', page: 'loans' }
    ]},
    { section: 'Security', items: [
      { icon: '🚨', label: 'Fraud Alerts', page: 'fraud' },
      { icon: '📜', label: 'Audit Logs', page: 'logs' }
    ]},
    { section: 'System', items: [
      { icon: '🔧', label: 'Developer Panel', page: 'devpanel' },
      { icon: '⚙️', label: 'Settings', page: 'settings' }
    ]}
  ];
  const userNav = [
    { section: 'My Banking', items: [
      { icon: '🏠', label: 'My Dashboard', page: 'userdash' },
      { icon: '💳', label: 'My Accounts', page: 'myaccounts' },
      { icon: '💸', label: 'Transactions', page: 'mytransactions' },
      { icon: '🏦', label: 'My Loans', page: 'myloans' }
    ]}
  ];

  const sections = currentRole === 'admin' ? adminNav : userNav;
  nav.innerHTML = sections.map(s => `
    <div class="nav-section">
      <div class="nav-section-label">${s.section}</div>
      ${s.items.map(item => `
        <button class="nav-item" onclick="navigateTo('${item.page}')" data-page="${item.page}">
          <span class="nav-icon">${item.icon}</span> ${item.label}
        </button>
      `).join('')}
    </div>
  `).join('');
}

function updateSidebarUser() {
  const el = document.getElementById('sidebarUserInfo');
  if(!el || !currentUser) return;
  el.innerHTML = `<strong>${currentUser.fullName}</strong>${currentRole === 'admin' ? 'Administrator' : currentUser.accountNumber}`;
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    dashboard: 'Dashboard', analytics: 'Analytics', users: 'User Management',
    accounts: 'Accounts', transactions: 'Transactions', loans: 'Loan Management',
    fraud: 'Fraud Detection', logs: 'Audit Logs', devpanel: 'Developer Panel',
    settings: 'Settings', userdash: 'My Dashboard', myaccounts: 'My Accounts',
    mytransactions: 'My Transactions', myloans: 'My Loans'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  renderPage(page);
}

// ─── CLOCK & SIMULATION ──────────────────────────────────────────
function startClock() {
  setInterval(() => {
    simDate = new Date(simDate.getTime() + 1000 * simSpeedMultiplier);
    const el = document.getElementById('sysClock');
    if(el) el.textContent = simDate.toLocaleDateString() + ' ' + simDate.toLocaleTimeString();
  }, 1000);
}

function setSimSpeed(val) {
  simSpeedMultiplier = parseInt(val);
}

function startSimulation() {
  if(simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    if(DB.settings.autoSim) {
      runAutoSim();
    }
    // Process loan payments (every simulated day)
    processLoanPayments();
    saveDB();
  }, 30000);
}

function runAutoSim() {
  // Random transaction
  if(DB.users.length > 0) {
    const user = randItem(DB.users.filter(u => u.status === 'Active'));
    if(user) {
      const types = ['Deposit','Withdrawal','Transfer'];
      const type = randItem(types);
      const amount = randFloat(10, 2000);
      doTransaction(user, type, amount, randItem(['savings','checking','ewallet']), true);
    }
  }
}

function processLoanPayments() {
  const now = simDate;
  DB.loans.forEach(loan => {
    if(loan.status !== 'Active') return;
    const nextPayment = new Date(loan.nextPaymentDate);
    if(now >= nextPayment) {
      const user = DB.users.find(u => u.id === loan.userId);
      if(user && user.accounts.checking.balance >= loan.monthlyPayment) {
        user.accounts.checking.balance -= loan.monthlyPayment;
        loan.paidMonths++;
        loan.remainingBalance = Math.max(0, loan.remainingBalance - loan.monthlyPayment * 0.7);
        loan.nextPaymentDate = new Date(nextPayment.getTime() + 30 * 86400000).toISOString();
        if(loan.remainingBalance <= 0) {
          loan.status = 'Paid';
          // Improve credit score
          if(user.creditScore < 850) user.creditScore = Math.min(850, user.creditScore + 10);
          addNotif('Loan Paid Off', `${user.fullName} paid off loan ${loan.id}`, 'success');
        }
        addLog(user.fullName, 'loan', `Monthly payment ₱${loan.monthlyPayment.toFixed(2)} for ${loan.id}`);
      } else if(user) {
        // Mark overdue
        loan.status = 'Overdue';
        loan.latePenalties += 50;
        if(user.creditScore > 300) user.creditScore = Math.max(300, user.creditScore - 15);
        addNotif('Loan Overdue', `${user.fullName}'s loan ${loan.id} is overdue!`, 'warning');
      }
    }
  });
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────
function doTransaction(user, type, amount, accType, silent=false) {
  const acc = user.accounts[accType];
  if(!acc) return false;

  let success = true;
  let prevBal = acc.balance;

  if(type === 'Withdrawal' || type === 'ATM' || type === 'Card Payment') {
    if(acc.balance < amount) { if(!silent) toast('Insufficient funds', 'error'); return false; }
    acc.balance -= amount;
  } else if(type === 'Deposit') {
    acc.balance += amount;
  } else if(type === 'Transfer') {
    if(acc.balance < amount) { if(!silent) toast('Insufficient funds', 'error'); return false; }
    acc.balance -= amount;
    // Transfer to savings (simplified)
    user.accounts.savings.balance += amount;
  }

  acc.balance = parseFloat(acc.balance.toFixed(2));

  const tx = {
    id: genId('TXN'),
    userId: user.id,
    userAccNum: user.accountNumber,
    userName: user.fullName,
    accountType: accType,
    type,
    amount: parseFloat(amount.toFixed(2)),
    description: `${type} - ${accType}`,
    status: 'Completed',
    date: new Date().toISOString(),
    flagged: false,
    riskScore: 0,
    prevBalance: prevBal,
    newBalance: acc.balance
  };

  // Fraud detection
  const fraud = detectFraud(user, tx);
  if(fraud.risk === 'High') {
    tx.flagged = true;
    tx.riskScore = 90;
    user.status = 'Suspended';
    addNotif('🚨 Fraud Alert', `High-risk transaction by ${user.fullName}: ₱${amount}`, 'danger');
    addFraudAlert(user, tx, fraud);
  } else if(fraud.risk === 'Medium') {
    tx.flagged = true;
    tx.riskScore = 55;
    addNotif('⚠ Suspicious Activity', `Medium-risk transaction by ${user.fullName}`, 'warning');
    addFraudAlert(user, tx, fraud);
  }

  DB.transactions.unshift(tx);
  if(DB.transactions.length > 5000) DB.transactions = DB.transactions.slice(0, 5000);

  acc.transactions = acc.transactions || [];
  acc.transactions.unshift(tx.id);

  addLog(user.fullName, 'transaction', `${type} ₱${amount.toFixed(2)} from ${accType}`, { txId: tx.id });

  // Update credit score based on activity
  updateCreditScore(user, tx);

  if(!silent) toast(`${type} of ₱${amount.toFixed(2)} successful`, 'success');
  saveDB();
  return tx;
}

function detectFraud(user, tx) {
  const reasons = [];
  // Large transaction
  if(tx.amount > 10000) reasons.push('Large transaction');
  // Rapid transactions (more than 5 in last hour)
  const recent = DB.transactions.filter(t => t.userId === user.id && (Date.now() - new Date(t.date).getTime()) < 3600000);
  if(recent.length > 5) reasons.push('Rapid transactions');
  // Odd hours
  const h = new Date().getHours();
  if(h < 4 || h > 23) reasons.push('Unusual hours');

  const risk = reasons.length === 0 ? 'Low' : (reasons.length === 1 ? 'Medium' : 'High');
  return { risk, reasons };
}

function addFraudAlert(user, tx, fraud) {
  DB.fraudAlerts.unshift({
    id: genId('FRD'),
    userId: user.id,
    userName: user.fullName,
    txId: tx.id,
    amount: tx.amount,
    risk: fraud.risk,
    reasons: fraud.reasons,
    date: new Date().toISOString(),
    resolved: false
  });
}

function updateCreditScore(user, tx) {
  if(tx.type === 'Deposit' && tx.amount > 1000) {
    user.creditScore = Math.min(850, user.creditScore + 1);
  }
  const totalBal = Object.values(user.accounts).reduce((s, a) => s + a.balance, 0);
  if(totalBal > 50000) user.creditScore = Math.min(850, user.creditScore + 2);
}

// ─── LOAN OPERATIONS ──────────────────────────────────────────────
function applyLoan(user, type, principal, termMonths) {
  // Approval logic
  if(user.creditScore < 500 && principal > 10000) {
    toast('Loan denied — credit score too low', 'error');
    return null;
  }
  if(user.status !== 'Active') {
    toast('Account must be Active to apply for loans', 'error');
    return null;
  }

  const interestRate = user.creditScore >= 700 ? randFloat(4, 9) : randFloat(10, 24);
  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1+monthlyRate, termMonths)) / (Math.pow(1+monthlyRate, termMonths) - 1);

  const loan = {
    id: genId('LN'),
    userId: user.id,
    userAccNum: user.accountNumber,
    userName: user.fullName,
    type,
    principal: parseFloat(principal.toFixed(2)),
    interestRate,
    termMonths,
    monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
    paidMonths: 0,
    remainingBalance: parseFloat(principal.toFixed(2)),
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + termMonths * 30 * 86400000).toISOString(),
    status: 'Active',
    latePenalties: 0,
    nextPaymentDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString()
  };

  DB.loans.push(loan);
  user.loanIds = user.loanIds || [];
  user.loanIds.push(loan.id);

  // Deposit loan amount to checking
  user.accounts.checking.balance += principal;

  addLog(user.fullName, 'loan', `Loan approved: ${type} ₱${principal.toFixed(2)}`, { loanId: loan.id });
  addNotif('Loan Approved', `${user.fullName}: ${type} loan for ₱${principal.toFixed(2)}`, 'success');
  toast(`Loan approved! ₱${principal.toFixed(2)} deposited to checking`, 'success');
  saveDB();
  return loan;
}

// ─── PAGE RENDERERS ───────────────────────────────────────────────
function renderPage(page) {
  const el = document.getElementById('pageContent');
  el.innerHTML = '';

  const pages = {
    dashboard: renderDashboard,
    analytics: renderAnalytics,
    users: renderUsers,
    accounts: renderAccounts,
    transactions: renderTransactions,
    loans: renderLoans,
    fraud: renderFraud,
    logs: renderLogs,
    devpanel: renderDevPanel,
    settings: renderSettings,
    userdash: renderUserDash,
    myaccounts: renderMyAccounts,
    mytransactions: renderMyTransactions,
    myloans: renderMyLoans
  };

  if(pages[page]) pages[page](el);
  else el.innerHTML = '<div class="empty-state">Page not found</div>';
}

// ─── DASHBOARD ────────────────────────────────────────────────────
function renderDashboard(el) {
  const totalFunds = DB.users.reduce((s, u) => s + Object.values(u.accounts).reduce((ss, a) => ss + a.balance, 0), 0);
  const totalLoans = DB.loans.reduce((s, l) => s + l.remainingBalance, 0);
  const activeUsers = DB.users.filter(u => u.status === 'Active').length;
  const lockedUsers = DB.users.filter(u => u.status === 'Locked').length;
  const fraudAlerts = DB.fraudAlerts.filter(f => !f.resolved).length;
  const overdueLoans = DB.loans.filter(l => l.status === 'Overdue').length;

  const recentTxns = DB.transactions.slice(0, 8);
  const recentUsers = [...DB.users].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  el.innerHTML = `
    <div class="stat-grid">
      ${statCard('👥', 'Total Users', DB.users.length, `${activeUsers} active`, 'blue')}
      ${statCard('💰', 'Total Funds', formatCurrency(totalFunds), 'All accounts', 'green')}
      ${statCard('🏦', 'Total Loans', formatCurrency(totalLoans), `${DB.loans.length} active`, 'purple')}
      ${statCard('🔒', 'Locked Accounts', lockedUsers, 'Require attention', 'orange')}
      ${statCard('🚨', 'Fraud Alerts', fraudAlerts, 'Unresolved', 'red')}
      ${statCard('⚠️', 'Overdue Loans', overdueLoans, 'Pending payment', 'orange')}
      ${statCard('💸', 'Transactions', DB.transactions.length, 'Total recorded', 'blue')}
      ${statCard('📋', 'Audit Logs', DB.logs.length, 'System events', 'purple')}
    </div>

    <div class="card-row">
      <div class="info-card">
        <div class="chart-card-title">Recent Transactions</div>
        <table>
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${recentTxns.map(t => `
              <tr>
                <td>${t.userName}</td>
                <td>${t.type}</td>
                <td class="${t.type==='Deposit'?'text-green':'text-red'}">${formatCurrency(t.amount)}</td>
                <td>${statusBadge(t.status)}</td>
                <td class="text-muted">${formatDate(t.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="info-card">
        <div class="chart-card-title">Newest Users</div>
        <table>
          <thead><tr><th>Name</th><th>Account</th><th>Score</th><th>Status</th></tr></thead>
          <tbody>
            ${recentUsers.map(u => `
              <tr>
                <td>${u.fullName}</td>
                <td class="monospace text-muted" style="font-size:11px">${u.accountNumber}</td>
                <td>${creditBadge(u.creditScore)}</td>
                <td>${userStatusBadge(u.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Quick Actions</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-primary" onclick="showAddTransactionModal()">+ Transaction</button>
      <button class="btn btn-success" onclick="showAddLoanModal()">+ Loan</button>
      <button class="btn btn-secondary" onclick="generateRandomTransactions()">⚡ Auto Generate Txns</button>
      <button class="btn btn-secondary" onclick="exportCSV()">📥 Export CSV</button>
      <button class="btn btn-danger" onclick="if(confirm('Reset ALL data?')) resetDB()">🗑 Reset System</button>
    </div>
  `;
}

function statCard(icon, label, value, sub, color) {
  return `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon}</div>
      <div class="stat-info">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${sub}</div>
      </div>
    </div>
  `;
}

// ─── ANALYTICS ────────────────────────────────────────────────────
function renderAnalytics(el) {
  const txByType = {};
  DB.transactions.forEach(t => { txByType[t.type] = (txByType[t.type] || 0) + 1; });
  const loanByType = {};
  DB.loans.forEach(l => { loanByType[l.type] = (loanByType[l.type] || 0) + l.principal; });

  const txTypes = Object.entries(txByType);
  const maxTx = Math.max(...txTypes.map(x=>x[1]));

  const colors = ['#1a56db','#0ea472','#7c3aed','#f59e0b','#e53e3e','#06b6d4','#ec4899'];

  // Monthly transaction volume (last 6 months)
  const months = [];
  for(let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleDateString('en', {month:'short'}), year: d.getFullYear(), month: d.getMonth() });
  }
  const monthVols = months.map(m => {
    const count = DB.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    }).length;
    return { ...m, count };
  });
  const maxVol = Math.max(...monthVols.map(m => m.count), 1);

  // Credit score distribution
  const scoreBuckets = [
    { label:'300-499', min:300, max:499, color:'#e53e3e' },
    { label:'500-599', min:500, max:599, color:'#f59e0b' },
    { label:'600-699', min:600, max:699, color:'#06b6d4' },
    { label:'700-749', min:700, max:749, color:'#1a56db' },
    { label:'750-850', min:750, max:850, color:'#0ea472' }
  ];
  scoreBuckets.forEach(b => {
    b.count = DB.users.filter(u => u.creditScore >= b.min && u.creditScore <= b.max).length;
  });
  const maxBucket = Math.max(...scoreBuckets.map(b => b.count));

  const totalFunds = DB.users.reduce((s, u) => s + Object.values(u.accounts).reduce((ss, a) => ss + a.balance, 0), 0);
  const savingsTotal = DB.users.reduce((s, u) => s + u.accounts.savings.balance, 0);
  const checkingTotal = DB.users.reduce((s, u) => s + u.accounts.checking.balance, 0);
  const depositTotal = DB.users.reduce((s, u) => s + u.accounts.deposit.balance, 0);
  const ewalletTotal = DB.users.reduce((s, u) => s + u.accounts.ewallet.balance, 0);

  const accDistrib = [
    { label:'Savings', val: savingsTotal, color:'#1a56db' },
    { label:'Checking', val: checkingTotal, color:'#0ea472' },
    { label:'Time Deposit', val: depositTotal, color:'#7c3aed' },
    { label:'E-Wallet', val: ewalletTotal, color:'#f59e0b' }
  ];
  const maxAccVal = Math.max(...accDistrib.map(a=>a.val));

  el.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
      ${statCard('💰', 'Total System Funds', formatCurrency(totalFunds), 'All accounts combined', 'green')}
      ${statCard('📊', 'Avg Credit Score', Math.round(DB.users.reduce((s,u)=>s+u.creditScore,0)/DB.users.length), 'System average', 'blue')}
      ${statCard('💸', 'Avg Transaction', formatCurrency(DB.transactions.reduce((s,t)=>s+t.amount,0)/Math.max(1,DB.transactions.length)), 'Per transaction', 'purple')}
      ${statCard('🏦', 'Loan Approval Rate', Math.round(DB.loans.filter(l=>l.status!=='Rejected').length/Math.max(1,DB.loans.length)*100)+'%', 'Approved loans', 'orange')}
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-card-title">Transaction Volume (Last 6 Months)</div>
        <div class="bar-chart">
          ${monthVols.map(m => `
            <div class="bar-wrap">
              <div class="bar" style="background:#1a56db;height:${Math.round(m.count/maxVol*100)}%"></div>
              <div class="bar-label">${m.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-title">Credit Score Distribution</div>
        <div class="bar-chart">
          ${scoreBuckets.map(b => `
            <div class="bar-wrap">
              <div class="bar" style="background:${b.color};height:${maxBucket>0?Math.round(b.count/maxBucket*100):4}%"></div>
              <div class="bar-label" style="font-size:9px">${b.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-title">Transaction Types</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${txTypes.map((t,i) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:80px;font-size:12px;color:var(--text2)">${t[0]}</div>
              <div style="flex:1;background:var(--bg2);border-radius:20px;height:8px">
                <div style="width:${Math.round(t[1]/maxTx*100)}%;height:100%;background:${colors[i%colors.length]};border-radius:20px"></div>
              </div>
              <div style="width:30px;font-size:12px;font-weight:600">${t[1]}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-title">Account Balances Distribution</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${accDistrib.map(a => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:90px;font-size:12px;color:var(--text2)">${a.label}</div>
              <div style="flex:1;background:var(--bg2);border-radius:20px;height:8px">
                <div style="width:${Math.round(a.val/maxAccVal*100)}%;height:100%;background:${a.color};border-radius:20px"></div>
              </div>
              <div style="font-size:11px;font-weight:600;color:var(--text3)">${formatCurrency(a.val)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="chart-card" style="margin-bottom:14px">
      <div class="chart-card-title">Loan Status Breakdown</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        ${['Active','Paid','Overdue','Restructured'].map(s => {
          const count = DB.loans.filter(l=>l.status===s).length;
          const pct = Math.round(count/Math.max(1,DB.loans.length)*100);
          const colors2 = {Active:'#1a56db',Paid:'#0ea472',Overdue:'#e53e3e',Restructured:'#f59e0b'};
          return `<div style="text-align:center;padding:12px 20px;background:var(--bg2);border-radius:10px">
            <div style="font-size:28px;font-weight:700;font-family:var(--font-display);color:${colors2[s]}">${count}</div>
            <div style="font-size:12px;color:var(--text3)">${s} (${pct}%)</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ─── USERS TABLE ──────────────────────────────────────────────────
let usersPage = 1;
let usersSearch = '';
let usersSortCol = 'fullName';
let usersSortDir = 1;

function renderUsers(el) {
  const perPage = 20;
  let filtered = DB.users.filter(u =>
    !usersSearch ||
    u.fullName.toLowerCase().includes(usersSearch.toLowerCase()) ||
    u.accountNumber.toLowerCase().includes(usersSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(usersSearch.toLowerCase())
  );
  filtered.sort((a,b) => {
    let av = a[usersSortCol], bv = b[usersSortCol];
    if(typeof av === 'string') av = av.toLowerCase(), bv = bv.toLowerCase();
    return av < bv ? -usersSortDir : av > bv ? usersSortDir : 0;
  });
  const total = filtered.length;
  const pages = Math.ceil(total / perPage);
  usersPage = Math.max(1, Math.min(usersPage, pages));
  const slice = filtered.slice((usersPage-1)*perPage, usersPage*perPage);

  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Users (${total})</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ Add User</button>
        <button class="btn btn-secondary btn-sm" onclick="exportCSV('users')">📥 Export</button>
        <select class="search-input" style="width:130px" onchange="filterByStatus(this.value)">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Locked">Locked</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>
    </div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">User Directory</div>
        <div class="table-controls">
          <input type="text" class="search-input" placeholder="Search users..." value="${usersSearch}"
            oninput="usersSearch=this.value;usersPage=1;renderPage('users')">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${sortTh('fullName','Name',usersSortCol,usersSortDir,'users')}
              ${sortTh('accountNumber','Account #',usersSortCol,usersSortDir,'users')}
              ${sortTh('creditScore','Credit',usersSortCol,usersSortDir,'users')}
              ${sortTh('status','Status',usersSortCol,usersSortDir,'users')}
              <th>KYC</th>
              <th>Risk</th>
              ${sortTh('lastLogin','Last Login',usersSortCol,usersSortDir,'users')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${slice.map(u => `
              <tr>
                <td>
                  <div style="font-weight:500">${u.fullName}</div>
                  <div style="font-size:11px;color:var(--text3)">${u.email}</div>
                </td>
                <td><span class="monospace" style="font-size:12px">${u.accountNumber}</span></td>
                <td>${creditBadge(u.creditScore)}</td>
                <td>${userStatusBadge(u.status)}</td>
                <td>${kycBadge(u.kycStatus)}</td>
                <td>${riskBadge(u.riskLevel)}</td>
                <td class="text-muted" style="font-size:12px">${formatDate(u.lastLogin)}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-secondary btn-sm" onclick="showUserDetail('${u.id}')">View</button>
                    <button class="btn btn-secondary btn-sm" onclick="showEditUser('${u.id}')">Edit</button>
                    ${u.status==='Active'
                      ? `<button class="btn btn-danger btn-sm" onclick="lockUser('${u.id}')">Lock</button>`
                      : `<button class="btn btn-success btn-sm" onclick="unlockUser('${u.id}')">Unlock</button>`}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${paginationHTML(usersPage, pages, total, 'usersPage', 'users')}
    </div>
  `;
}

function sortTh(col, label, sortCol, sortDir, page) {
  const active = sortCol === col;
  const arrow = active ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
  return `<th onclick="setSort('${col}','${page}')" style="cursor:pointer">${label}${arrow}</th>`;
}

function setSort(col, page) {
  if(page === 'users') {
    if(usersSortCol === col) usersSortDir *= -1;
    else { usersSortCol = col; usersSortDir = 1; }
  } else if(page === 'transactions') {
    if(txSortCol === col) txSortDir *= -1;
    else { txSortCol = col; txSortDir = 1; }
  } else if(page === 'loans') {
    if(loanSortCol === col) loanSortDir *= -1;
    else { loanSortCol = col; loanSortDir = 1; }
  }
  renderPage(page);
}

function filterByStatus(val) {
  usersStatusFilter = val;
  usersPage = 1;
  renderPage('users');
}

let usersStatusFilter = '';

function paginationHTML(page, pages, total, varName, renderPage_) {
  return `
    <div class="pagination">
      <span>Showing ${Math.min((page-1)*20+1, total)}–${Math.min(page*20, total)} of ${total}</span>
      <div class="pagination-btns">
        <button onclick="${varName}=Math.max(1,${varName}-1);renderPage('${renderPage_}')" ${page<=1?'disabled':''}>‹</button>
        ${Array.from({length:Math.min(5,pages)},(_,i)=>{
          const p = Math.max(1,Math.min(pages-4,page-2))+i;
          return `<button class="${p===page?'active':''}" onclick="${varName}=${p};renderPage('${renderPage_}')">${p}</button>`;
        }).join('')}
        <button onclick="${varName}=Math.min(${pages},${varName}+1);renderPage('${renderPage_}')" ${page>=pages?'disabled':''}>›</button>
      </div>
    </div>
  `;
}

// ─── TRANSACTIONS TABLE ───────────────────────────────────────────
let txPage = 1, txSearch = '', txSortCol = 'date', txSortDir = -1;

function renderTransactions(el) {
  const perPage = 25;
  let filtered = DB.transactions.filter(t =>
    !txSearch ||
    t.userName.toLowerCase().includes(txSearch.toLowerCase()) ||
    t.type.toLowerCase().includes(txSearch.toLowerCase()) ||
    t.id.toLowerCase().includes(txSearch.toLowerCase())
  );
  filtered.sort((a,b)=>{
    let av=a[txSortCol],bv=b[txSortCol];
    if(typeof av==='string') av=av.toLowerCase(),bv=bv.toLowerCase();
    return av<bv?-txSortDir:av>bv?txSortDir:0;
  });
  const total = filtered.length;
  const pages = Math.ceil(total/perPage);
  txPage = Math.max(1,Math.min(txPage,pages));
  const slice = filtered.slice((txPage-1)*perPage,txPage*perPage);

  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Transactions (${total})</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="showAddTransactionModal()">+ New Transaction</button>
        <button class="btn btn-secondary btn-sm" onclick="generateRandomTransactions()">⚡ Generate</button>
        <button class="btn btn-secondary btn-sm" onclick="exportCSV('transactions')">📥 Export</button>
      </div>
    </div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">All Transactions</div>
        <div class="table-controls">
          <input type="text" class="search-input" placeholder="Search..." value="${txSearch}"
            oninput="txSearch=this.value;txPage=1;renderPage('transactions')">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${sortTh('id','TX ID',txSortCol,txSortDir,'transactions')}
            ${sortTh('userName','User',txSortCol,txSortDir,'transactions')}
            ${sortTh('type','Type',txSortCol,txSortDir,'transactions')}
            ${sortTh('amount','Amount',txSortCol,txSortDir,'transactions')}
            <th>Account</th>
            ${sortTh('status','Status',txSortCol,txSortDir,'transactions')}
            <th>Risk</th>
            ${sortTh('date','Date',txSortCol,txSortDir,'transactions')}
          </tr></thead>
          <tbody>
            ${slice.map(t => `
              <tr ${t.flagged?'style="background:rgba(229,62,62,0.04)"':''}>
                <td><span class="monospace" style="font-size:11px">${t.id}</span></td>
                <td>${t.userName}</td>
                <td>${t.type}</td>
                <td class="${t.type==='Deposit'?'text-green':'text-red'} fw-600">${formatCurrency(t.amount)}</td>
                <td><span class="badge gray">${t.accountType}</span></td>
                <td>${statusBadge(t.status)}</td>
                <td>${t.flagged?'<span class="risk-indicator risk-high">⚠ High</span>':'<span class="risk-indicator risk-low">✓ Low</span>'}</td>
                <td class="text-muted" style="font-size:12px">${formatDate(t.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${paginationHTML(txPage, pages, total, 'txPage', 'transactions')}
    </div>
  `;
}

// ─── ACCOUNTS ────────────────────────────────────────────────────
function renderAccounts(el) {
  const totalSavings = DB.users.reduce((s,u)=>s+u.accounts.savings.balance,0);
  const totalChecking = DB.users.reduce((s,u)=>s+u.accounts.checking.balance,0);
  const totalDeposit = DB.users.reduce((s,u)=>s+u.accounts.deposit.balance,0);
  const totalEwallet = DB.users.reduce((s,u)=>s+u.accounts.ewallet.balance,0);

  el.innerHTML = `
    <div class="stat-grid">
      ${statCard('💰', 'Savings Accounts', formatCurrency(totalSavings), `${DB.users.length} accounts`, 'blue')}
      ${statCard('💳', 'Checking Accounts', formatCurrency(totalChecking), `${DB.users.length} accounts`, 'green')}
      ${statCard('🏛', 'Time Deposits', formatCurrency(totalDeposit), `${DB.users.length} accounts`, 'purple')}
      ${statCard('📱', 'E-Wallets', formatCurrency(totalEwallet), `${DB.users.length} accounts`, 'orange')}
    </div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Account Overview — Top Balances</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Account #</th><th>Savings</th><th>Checking</th><th>Deposit</th><th>E-Wallet</th><th>Total</th><th>Card</th></tr></thead>
          <tbody>
            ${[...DB.users].sort((a,b)=>{
              const ta = Object.values(a.accounts).reduce((s,ac)=>s+ac.balance,0);
              const tb = Object.values(b.accounts).reduce((s,ac)=>s+ac.balance,0);
              return tb - ta;
            }).slice(0,30).map(u => {
              const total = Object.values(u.accounts).reduce((s,a)=>s+a.balance,0);
              return `<tr>
                <td>${u.fullName}</td>
                <td class="monospace" style="font-size:11px">${u.accountNumber}</td>
                <td class="text-blue">${formatCurrency(u.accounts.savings.balance)}</td>
                <td class="text-green">${formatCurrency(u.accounts.checking.balance)}</td>
                <td class="text-purple">${formatCurrency(u.accounts.deposit.balance)}</td>
                <td style="color:var(--orange)">${formatCurrency(u.accounts.ewallet.balance)}</td>
                <td class="fw-600">${formatCurrency(total)}</td>
                <td><span class="badge ${u.card.active?'green':'red'}">${u.card.active?'Active':'Inactive'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── LOANS TABLE ─────────────────────────────────────────────────
let loanPage = 1, loanSearch = '', loanSortCol = 'startDate', loanSortDir = -1;

function renderLoans(el) {
  const perPage = 20;
  let filtered = DB.loans.filter(l =>
    !loanSearch ||
    l.userName.toLowerCase().includes(loanSearch.toLowerCase()) ||
    l.type.toLowerCase().includes(loanSearch.toLowerCase()) ||
    l.id.toLowerCase().includes(loanSearch.toLowerCase())
  );
  filtered.sort((a,b)=>{
    let av=a[loanSortCol],bv=b[loanSortCol];
    if(typeof av==='string') av=av.toLowerCase(),bv=bv.toLowerCase();
    return av<bv?-loanSortDir:av>bv?loanSortDir:0;
  });
  const total = filtered.length;
  const pages = Math.ceil(total/perPage);
  loanPage = Math.max(1,Math.min(loanPage,pages));
  const slice = filtered.slice((loanPage-1)*perPage,loanPage*perPage);
  const totalPrincipal = DB.loans.reduce((s,l)=>s+l.principal,0);
  const totalRemaining = DB.loans.reduce((s,l)=>s+l.remainingBalance,0);

  el.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
      ${statCard('📊','Total Loans',DB.loans.length,'All time','blue')}
      ${statCard('💰','Total Principal',formatCurrency(totalPrincipal),'Disbursed','green')}
      ${statCard('📉','Outstanding',formatCurrency(totalRemaining),'Remaining balance','orange')}
      ${statCard('⚠️','Overdue',DB.loans.filter(l=>l.status==='Overdue').length,'Needs attention','red')}
    </div>
    <div class="section-header">
      <div class="section-title">Loan Management</div>
      <button class="btn btn-primary btn-sm" onclick="showAddLoanModal()">+ New Loan</button>
    </div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">All Loans</div>
        <input type="text" class="search-input" placeholder="Search loans..." value="${loanSearch}"
          oninput="loanSearch=this.value;loanPage=1;renderPage('loans')">
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Loan ID</th>
            ${sortTh('userName','User',loanSortCol,loanSortDir,'loans')}
            ${sortTh('type','Type',loanSortCol,loanSortDir,'loans')}
            ${sortTh('principal','Principal',loanSortCol,loanSortDir,'loans')}
            <th>Interest</th>
            <th>Monthly</th>
            <th>Remaining</th>
            ${sortTh('status','Status',loanSortCol,loanSortDir,'loans')}
            <th>End Date</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            ${slice.map(l => `<tr>
              <td class="monospace" style="font-size:11px">${l.id}</td>
              <td>${l.userName}</td>
              <td><span class="badge blue">${l.type}</span></td>
              <td class="fw-600">${formatCurrency(l.principal)}</td>
              <td>${l.interestRate.toFixed(1)}%</td>
              <td>${formatCurrency(l.monthlyPayment)}</td>
              <td class="${l.status==='Overdue'?'text-red fw-600':''}">${formatCurrency(l.remainingBalance)}</td>
              <td>${loanStatusBadge(l.status)}</td>
              <td class="text-muted" style="font-size:12px">${formatDate(l.endDate)}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-secondary btn-sm" onclick="showLoanDetail('${l.id}')">View</button>
                  ${l.status==='Overdue'?`<button class="btn btn-warning btn-sm" onclick="restructureLoan('${l.id}')">Restructure</button>`:''}
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${paginationHTML(loanPage, pages, total, 'loanPage', 'loans')}
    </div>
  `;
}

// ─── FRAUD ────────────────────────────────────────────────────────
function renderFraud(el) {
  const unresolved = DB.fraudAlerts.filter(f=>!f.resolved);
  el.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      ${statCard('🚨','Total Alerts',DB.fraudAlerts.length,'All time','red')}
      ${statCard('⚠️','Unresolved',unresolved.length,'Require action','orange')}
      ${statCard('✓','Resolved',DB.fraudAlerts.filter(f=>f.resolved).length,'Cleared','green')}
    </div>
    <div class="table-card">
      <div class="table-header"><div class="table-title">Fraud Alerts</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>User</th><th>Amount</th><th>Risk</th><th>Reasons</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${DB.fraudAlerts.length === 0 ? '<tr><td colspan="8" class="empty-state">No fraud alerts</td></tr>' :
              DB.fraudAlerts.slice(0,50).map(f=>`<tr>
                <td class="monospace" style="font-size:11px">${f.id}</td>
                <td>${f.userName}</td>
                <td class="text-red fw-600">${formatCurrency(f.amount)}</td>
                <td>${riskBadge(f.risk)}</td>
                <td style="font-size:12px;color:var(--text3)">${(f.reasons||[]).join(', ')}</td>
                <td class="text-muted" style="font-size:12px">${formatDate(f.date)}</td>
                <td>${f.resolved?'<span class="badge green">Resolved</span>':'<span class="badge red">Open</span>'}</td>
                <td>${!f.resolved?`<button class="btn btn-success btn-sm" onclick="resolveFraud('${f.id}')">Resolve</button>`:'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function resolveFraud(id) {
  const alert = DB.fraudAlerts.find(f=>f.id===id);
  if(alert) {
    alert.resolved = true;
    notifCount = Math.max(0, notifCount - 1);
    updateNotifBadge();
    addLog('admin','fraud',`Fraud alert ${id} resolved`);
    toast('Alert resolved','success');
    saveDB();
    renderPage('fraud');
  }
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────
let logPage = 1, logSearch = '';

function renderLogs(el) {
  const perPage = 30;
  let filtered = DB.logs.filter(l =>
    !logSearch ||
    l.message.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.actor.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.type.toLowerCase().includes(logSearch.toLowerCase())
  );
  const total = filtered.length;
  const pages = Math.ceil(total/perPage);
  logPage = Math.max(1,Math.min(logPage,pages));
  const slice = filtered.slice((logPage-1)*perPage,logPage*perPage);

  const typeColors = { login:'blue', logout:'gray', transaction:'green', loan:'purple', system:'orange', fraud:'red', admin:'blue' };

  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">Audit Logs (${total})</div>
      <button class="btn btn-secondary btn-sm" onclick="exportCSV('logs')">📥 Export CSV</button>
    </div>
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">System Activity Log</div>
        <input type="text" class="search-input" placeholder="Search logs..." value="${logSearch}"
          oninput="logSearch=this.value;logPage=1;renderPage('logs')">
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Log ID</th><th>Actor</th><th>Type</th><th>Message</th><th>Date</th></tr></thead>
          <tbody>
            ${slice.map(l=>`<tr>
              <td class="monospace" style="font-size:11px">${l.id}</td>
              <td class="fw-600">${l.actor}</td>
              <td><span class="badge ${typeColors[l.type]||'gray'}">${l.type}</span></td>
              <td style="max-width:300px">${l.message}</td>
              <td class="text-muted" style="font-size:12px">${formatDate(l.date)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${paginationHTML(logPage, pages, total, 'logPage', 'logs')}
    </div>
  `;
}

// ─── DEV PANEL ────────────────────────────────────────────────────
function renderDevPanel(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-title">⚠ Developer Panel</div>
      <span class="badge orange">Admin Only</span>
    </div>
    <div class="dev-panel">
      <h4>Raw JSON Editor</h4>
      <textarea id="rawJson" rows="12">${JSON.stringify({users: DB.users.slice(0,3), settings: DB.settings}, null, 2)}</textarea>
      <div>
        <button class="dev-btn" onclick="viewFullDB()">View Full DB</button>
        <button class="dev-btn" onclick="forceApplyJson()">Apply Changes</button>
        <button class="dev-btn" onclick="viewUserJson()">View Users JSON</button>
        <button class="dev-btn" onclick="viewLoansJson()">View Loans JSON</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="info-card">
        <div class="chart-card-title">Force Actions</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-danger" onclick="simulateError()">Simulate System Error</button>
          <button class="btn btn-secondary" onclick="generateRandomTransactions()">Generate 50 Random Txns</button>
          <button class="btn btn-secondary" onclick="DB.settings.autoSim=!DB.settings.autoSim;toast('Auto-sim: '+(DB.settings.autoSim?'ON':'OFF'),'info');saveDB()">Toggle Auto-Sim</button>
          <button class="btn btn-secondary" onclick="resetCreditScores()">Randomize Credit Scores</button>
          <button class="btn btn-secondary" onclick="unlockAllUsers()">Unlock All Users</button>
          <button class="btn btn-danger" onclick="if(confirm('Reset system?')) resetDB()">⚠ Full Reset</button>
        </div>
      </div>
      <div class="info-card">
        <div class="chart-card-title">System Stats</div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text2);line-height:2">
          Users: ${DB.users.length}<br>
          Transactions: ${DB.transactions.length}<br>
          Loans: ${DB.loans.length}<br>
          Logs: ${DB.logs.length}<br>
          Fraud Alerts: ${DB.fraudAlerts.length}<br>
          Notifications: ${DB.notifications.length}<br>
          LocalStorage: ~${Math.round(JSON.stringify(DB).length/1024)}KB<br>
          Sim Date: ${simDate.toLocaleDateString()}<br>
          Auto-Sim: ${DB.settings.autoSim ? 'ON' : 'OFF'}
        </div>
      </div>
    </div>
  `;
}

function viewFullDB() {
  document.getElementById('rawJson').value = JSON.stringify(DB, null, 2);
}
function viewUserJson() {
  document.getElementById('rawJson').value = JSON.stringify(DB.users.slice(0,5), null, 2);
}
function viewLoansJson() {
  document.getElementById('rawJson').value = JSON.stringify(DB.loans.slice(0,5), null, 2);
}
function forceApplyJson() {
  try {
    const parsed = JSON.parse(document.getElementById('rawJson').value);
    Object.assign(DB, parsed);
    saveDB();
    toast('JSON applied successfully','success');
    renderPage(currentPage);
  } catch(e) { toast('Invalid JSON: '+e.message,'error'); }
}
function simulateError() {
  addNotif('System Error','Simulated critical system error for testing','danger');
  toast('System error simulated','error');
  addLog('SYSTEM','system','Simulated error triggered by admin');
}
function resetCreditScores() {
  DB.users.forEach(u => u.creditScore = genCreditScore());
  saveDB();
  toast('Credit scores randomized','info');
}
function unlockAllUsers() {
  DB.users.forEach(u => { if(u.status==='Locked') { u.status='Active'; u.failedLogins=0; }});
  saveDB();
  toast('All locked users unlocked','success');
  renderPage(currentPage);
}

// ─── SETTINGS ────────────────────────────────────────────────────
function renderSettings(el) {
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">System Settings</div>
    <div class="card-row">
      <div class="info-card">
        <div class="chart-card-title">Appearance</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="field-group">
            <label>Theme</label>
            <select onchange="setTheme(this.value)">
              <option value="light" ${DB.settings.theme==='light'?'selected':''}>Light</option>
              <option value="dark" ${DB.settings.theme==='dark'?'selected':''}>Dark</option>
            </select>
          </div>
        </div>
      </div>
      <div class="info-card">
        <div class="chart-card-title">Simulation</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="field-group">
            <label>Simulation Speed</label>
            <select onchange="setSimSpeed(this.value)">
              <option value="1">1x — Real-time</option>
              <option value="10">10x — Fast</option>
              <option value="100">100x — Ultra Fast</option>
            </select>
          </div>
          <div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" ${DB.settings.autoSim?'checked':''} onchange="DB.settings.autoSim=this.checked;saveDB()">
              Enable Auto-Simulation
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="info-card">
      <div class="chart-card-title">Data Management</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-secondary" onclick="saveDB();toast('Data saved','success')">💾 Save Now</button>
        <button class="btn btn-secondary" onclick="exportCSV()">📥 Export CSV</button>
        <button class="btn btn-secondary" onclick="backupData()">📦 Backup JSON</button>
        <button class="btn btn-danger" onclick="if(confirm('This will delete ALL data. Are you sure?')) resetDB()">🗑 Reset System</button>
      </div>
    </div>
  `;
}

function setTheme(theme) {
  DB.settings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  saveDB();
}

function toggleTheme() {
  const newTheme = DB.settings.theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  document.querySelector('.theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// ─── USER DASHBOARD ───────────────────────────────────────────────
function renderUserDash(el) {
  const u = currentUser;
  const loans = DB.loans.filter(l => l.userId === u.id);
  const txns = DB.transactions.filter(t => t.userId === u.id);
  const totalBalance = Object.values(u.accounts).reduce((s,a)=>s+a.balance,0);
  const ct = creditTier(u.creditScore);

  el.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-family:var(--font-display);font-size:24px;font-weight:800">Welcome back, ${u.firstName}!</div>
      <div style="color:var(--text3);margin-top:4px">${u.accountNumber} · ${u.email}</div>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
      ${statCard('💰','Total Balance',formatCurrency(totalBalance),'All accounts','blue')}
      ${statCard('🏦','Active Loans',loans.filter(l=>l.status==='Active').length,'Current loans','purple')}
      ${statCard('💸','Transactions',txns.length,'All time','green')}
      ${statCard('⭐','Credit Score',u.creditScore,ct.label,ct.color)}
    </div>
    <div class="account-cards">
      ${Object.entries(u.accounts).map(([k,a])=>`
        <div class="account-card ${k}">
          <div class="acc-type">${k === 'deposit' ? 'Time Deposit' : k === 'ewallet' ? 'E-Wallet' : k.charAt(0).toUpperCase()+k.slice(1)}</div>
          <div class="acc-balance">${formatCurrency(a.balance)}</div>
          <div class="acc-num">${u.accountNumber}</div>
          ${k === 'deposit' ? `<div style="font-size:11px;opacity:0.7;margin-top:4px">Matures: ${a.maturityDate ? new Date(a.maturityDate).toLocaleDateString() : 'N/A'}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="card-row">
      <div class="info-card">
        <div class="chart-card-title">Quick Transfer</div>
        <div class="form-row single">
          <div class="field-group">
            <label>From Account</label>
            <select id="txFromAcc"><option value="savings">Savings</option><option value="checking">Checking</option><option value="ewallet">E-Wallet</option></select>
          </div>
        </div>
        <div class="form-row">
          <div class="field-group">
            <label>Amount</label>
            <input type="number" id="txAmt" placeholder="0.00" min="0.01">
          </div>
          <div class="field-group">
            <label>Type</label>
            <select id="txType"><option value="Deposit">Deposit</option><option value="Withdrawal">Withdrawal</option><option value="Transfer">Transfer</option></select>
          </div>
        </div>
        <button class="btn btn-primary" onclick="doUserTransaction()">Submit Transaction</button>
      </div>
      <div class="info-card">
        <div class="chart-card-title">My Debit Card</div>
        <div class="account-card checking" style="max-width:280px;margin-bottom:12px">
          <div style="font-size:11px;opacity:0.6">NEXABANK</div>
          <div style="font-family:var(--font-mono);font-size:14px;letter-spacing:2px;margin:12px 0">${u.card.number.replace(/\d(?=\d{4})/g,'*')}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <div><div style="opacity:0.5;font-size:10px">EXPIRES</div>${u.card.expiry}</div>
            <div><div style="opacity:0.5;font-size:10px">CVV</div>***</div>
          </div>
          <div style="margin-top:8px;font-size:13px;font-weight:600">${u.fullName.toUpperCase()}</div>
        </div>
        <span class="badge ${u.card.active?'green':'red'}">${u.card.active?'Active':'Inactive'}</span>
      </div>
    </div>
  `;
}

function doUserTransaction() {
  const acc = document.getElementById('txFromAcc').value;
  const amt = parseFloat(document.getElementById('txAmt').value);
  const type = document.getElementById('txType').value;
  if(!amt || amt <= 0) { toast('Enter a valid amount','error'); return; }
  const result = doTransaction(currentUser, type, amt, acc);
  if(result) renderPage('userdash');
}

// ─── MY ACCOUNTS ─────────────────────────────────────────────────
function renderMyAccounts(el) {
  const u = currentUser;
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">My Accounts</div>
    <div class="account-cards">
      ${Object.entries(u.accounts).map(([k,a])=>`
        <div class="account-card ${k}">
          <div class="acc-type">${k==='deposit'?'Time Deposit':k==='ewallet'?'E-Wallet':k.charAt(0).toUpperCase()+k.slice(1)}</div>
          <div class="acc-balance">${formatCurrency(a.balance)}</div>
          <div class="acc-num">${u.accountNumber}</div>
          ${a.interestRate?`<div style="font-size:11px;opacity:0.7;margin-top:4px">Interest: ${a.interestRate.toFixed(2)}% p.a.</div>`:''}
        </div>
      `).join('')}
    </div>
    <div class="info-card">
      <div class="chart-card-title">Account Details</div>
      <table>
        <thead><tr><th>Account Type</th><th>Balance</th><th>Interest Rate</th><th>Transactions</th></tr></thead>
        <tbody>
          ${Object.entries(u.accounts).map(([k,a])=>`<tr>
            <td>${k==='deposit'?'Time Deposit':k==='ewallet'?'E-Wallet':k.charAt(0).toUpperCase()+k.slice(1)}</td>
            <td class="fw-600">${formatCurrency(a.balance)}</td>
            <td>${a.interestRate?a.interestRate.toFixed(2)+'%':'—'}</td>
            <td>${(a.transactions||[]).length}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── MY TRANSACTIONS ─────────────────────────────────────────────
function renderMyTransactions(el) {
  const txns = DB.transactions.filter(t=>t.userId===currentUser.id);
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">My Transactions (${txns.length})</div>
    <div class="table-card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Account</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${txns.slice(0,50).map(t=>`<tr>
              <td class="monospace" style="font-size:11px">${t.id}</td>
              <td>${t.type}</td>
              <td><span class="badge gray">${t.accountType}</span></td>
              <td class="${t.type==='Deposit'?'text-green':'text-red'} fw-600">${formatCurrency(t.amount)}</td>
              <td>${statusBadge(t.status)}</td>
              <td class="text-muted" style="font-size:12px">${formatDate(t.date)}</td>
            </tr>`).join('')}
            ${txns.length===0?'<tr><td colspan="6" class="empty-state">No transactions yet</td></tr>':''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── MY LOANS ────────────────────────────────────────────────────
function renderMyLoans(el) {
  const loans = DB.loans.filter(l=>l.userId===currentUser.id);
  el.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">My Loans (${loans.length})</div>
    <div style="margin-bottom:12px">
      <button class="btn btn-primary" onclick="showApplyLoanModal()">Apply for Loan</button>
    </div>
    ${loans.length===0?'<div class="empty-state">No active loans</div>':
      loans.map(l=>`
        <div class="info-card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div class="fw-600" style="font-size:15px">${l.type} Loan</div>
              <div class="text-muted" style="font-size:12px">${l.id}</div>
            </div>
            ${loanStatusBadge(l.status)}
          </div>
          <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Principal</div><div class="detail-value">${formatCurrency(l.principal)}</div></div>
            <div class="detail-item"><div class="detail-label">Remaining</div><div class="detail-value text-red">${formatCurrency(l.remainingBalance)}</div></div>
            <div class="detail-item"><div class="detail-label">Monthly Payment</div><div class="detail-value">${formatCurrency(l.monthlyPayment)}</div></div>
            <div class="detail-item"><div class="detail-label">Interest Rate</div><div class="detail-value">${l.interestRate.toFixed(2)}%</div></div>
            <div class="detail-item"><div class="detail-label">End Date</div><div class="detail-value">${formatDate(l.endDate)}</div></div>
            <div class="detail-item"><div class="detail-label">Months Paid</div><div class="detail-value">${l.paidMonths} / ${l.termMonths}</div></div>
          </div>
          <div style="margin-top:8px;background:var(--bg2);border-radius:8px;height:8px">
            <div style="width:${Math.min(100,Math.round(l.paidMonths/l.termMonths*100))}%;height:100%;background:var(--green);border-radius:8px"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">${Math.round(l.paidMonths/l.termMonths*100)}% paid</div>
          ${l.latePenalties>0?`<div class="badge red" style="margin-top:8px">Late Penalty: ${formatCurrency(l.latePenalties)}</div>`:''}
        </div>
      `).join('')}
  `;
}

// ─── MODALS ───────────────────────────────────────────────────────
function showModal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function showAddTransactionModal() {
  const userOptions = DB.users.filter(u=>u.status==='Active').slice(0,50).map(u=>`<option value="${u.id}">${u.fullName} — ${u.accountNumber}</option>`).join('');
  showModal(`
    <div class="modal-title">New Transaction</div>
    <div class="form-row single">
      <div class="field-group">
        <label>User</label>
        <select id="m_userId">
          ${currentRole==='user'?`<option value="${currentUser.id}">${currentUser.fullName}</option>`:userOptions}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field-group">
        <label>Type</label>
        <select id="m_type">
          <option>Deposit</option><option>Withdrawal</option><option>Transfer</option><option>ATM</option><option>Card Payment</option>
        </select>
      </div>
      <div class="field-group">
        <label>Account</label>
        <select id="m_acc">
          <option value="savings">Savings</option>
          <option value="checking">Checking</option>
          <option value="ewallet">E-Wallet</option>
        </select>
      </div>
    </div>
    <div class="form-row single">
      <div class="field-group">
        <label>Amount (₱)</label>
        <input type="number" id="m_amount" placeholder="0.00" min="0.01" step="0.01">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitTransaction()">Submit</button>
    </div>
  `);
}

function submitTransaction() {
  const userId = document.getElementById('m_userId').value;
  const type = document.getElementById('m_type').value;
  const acc = document.getElementById('m_acc').value;
  const amount = parseFloat(document.getElementById('m_amount').value);
  const user = DB.users.find(u=>u.id===userId);
  if(!user) { toast('User not found','error'); return; }
  if(!amount || amount <= 0) { toast('Enter a valid amount','error'); return; }
  const result = doTransaction(user, type, amount, acc);
  if(result) { closeModal(); renderPage(currentPage); }
}

function showAddLoanModal() {
  const userOptions = DB.users.filter(u=>u.status==='Active').slice(0,50).map(u=>`<option value="${u.id}">${u.fullName} — Score: ${u.creditScore}</option>`).join('');
  showModal(`
    <div class="modal-title">New Loan Application</div>
    <div class="form-row single">
      <div class="field-group">
        <label>User</label>
        <select id="l_userId">${currentRole==='user'?`<option value="${currentUser.id}">${currentUser.fullName}</option>`:userOptions}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="field-group">
        <label>Loan Type</label>
        <select id="l_type">
          ${LOAN_TYPES.map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Term (Months)</label>
        <select id="l_term">
          <option value="12">12 months</option>
          <option value="24">24 months</option>
          <option value="36" selected>36 months</option>
          <option value="48">48 months</option>
          <option value="60">60 months</option>
          <option value="84">84 months</option>
          <option value="120">120 months</option>
        </select>
      </div>
    </div>
    <div class="form-row single">
      <div class="field-group">
        <label>Principal Amount (₱)</label>
        <input type="number" id="l_principal" placeholder="10000" min="1000" step="500">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitLoan()">Apply</button>
    </div>
  `);
}

function submitLoan() {
  const userId = document.getElementById('l_userId').value;
  const type = document.getElementById('l_type').value;
  const term = parseInt(document.getElementById('l_term').value);
  const principal = parseFloat(document.getElementById('l_principal').value);
  const user = DB.users.find(u=>u.id===userId);
  if(!user) { toast('User not found','error'); return; }
  if(!principal || principal < 1000) { toast('Minimum loan is ₱1,000','error'); return; }
  const loan = applyLoan(user, type, principal, term);
  if(loan) { closeModal(); renderPage(currentPage); }
}

function showApplyLoanModal() {
  showModal(`
    <div class="modal-title">Apply for a Loan</div>
    <div class="form-row">
      <div class="field-group">
        <label>Loan Type</label>
        <select id="l_type">
          ${LOAN_TYPES.map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Term</label>
        <select id="l_term">
          <option value="12">12 months</option>
          <option value="24">24 months</option>
          <option value="36" selected>36 months</option>
          <option value="48">48 months</option>
          <option value="60">60 months</option>
        </select>
      </div>
    </div>
    <div class="form-row single">
      <div class="field-group">
        <label>Amount (₱)</label>
        <input type="number" id="l_principal" placeholder="10000" min="1000">
      </div>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:12px;font-size:13px;color:var(--text2)">
      Your credit score: <strong>${currentUser.creditScore}</strong> — ${creditTier(currentUser.creditScore).label}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitMyLoan()">Apply</button>
    </div>
  `);
}

function submitMyLoan() {
  const type = document.getElementById('l_type').value;
  const term = parseInt(document.getElementById('l_term').value);
  const principal = parseFloat(document.getElementById('l_principal').value);
  if(!principal || principal < 1000) { toast('Minimum loan is ₱1,000','error'); return; }
  const loan = applyLoan(currentUser, type, principal, term);
  if(loan) { closeModal(); renderPage('myloans'); }
}

function showAddUserModal() {
  showModal(`
    <div class="modal-title">Add New User</div>
    <div class="form-row">
      <div class="field-group"><label>First Name</label><input type="text" id="u_fname" placeholder="First name"></div>
      <div class="field-group"><label>Last Name</label><input type="text" id="u_lname" placeholder="Last name"></div>
    </div>
    <div class="form-row single">
      <div class="field-group"><label>Email</label><input type="email" id="u_email" placeholder="email@example.com"></div>
    </div>
    <div class="form-row">
      <div class="field-group"><label>Password</label><input type="password" id="u_pass" value="pass123"></div>
      <div class="field-group"><label>Initial Balance (₱)</label><input type="number" id="u_bal" placeholder="5000" value="5000"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddUser()">Create User</button>
    </div>
  `);
}

function submitAddUser() {
  const fn = document.getElementById('u_fname').value.trim();
  const ln = document.getElementById('u_lname').value.trim();
  const em = document.getElementById('u_email').value.trim();
  const pw = document.getElementById('u_pass').value.trim();
  const bal = parseFloat(document.getElementById('u_bal').value) || 5000;
  if(!fn || !ln) { toast('Name is required','error'); return; }
  const user = genUser(DB.users.length + 1);
  user.firstName = fn; user.lastName = ln; user.fullName = `${fn} ${ln}`;
  user.email = em || user.email;
  user.password = pw || 'pass123';
  user.accounts.savings.balance = bal;
  DB.users.push(user);
  addLog('admin','admin',`New user created: ${user.fullName}`);
  addNotif('New User','User '+user.fullName+' created','success');
  toast('User created: '+user.accountNumber,'success');
  saveDB();
  closeModal();
  renderPage('users');
}

function showUserDetail(id) {
  const u = DB.users.find(u=>u.id===id);
  if(!u) return;
  const loans = DB.loans.filter(l=>l.userId===u.id);
  const txns = DB.transactions.filter(t=>t.userId===u.id);
  const ct = creditTier(u.creditScore);
  showModal(`
    <div class="modal-title">${u.fullName}</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Account #</div><div class="detail-value monospace">${u.accountNumber}</div></div>
      <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${u.email}</div></div>
      <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${u.phone}</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${userStatusBadge(u.status)}</div></div>
      <div class="detail-item"><div class="detail-label">Credit Score</div><div class="detail-value">${u.creditScore} <span class="badge ${ct.color}">${ct.label}</span></div></div>
      <div class="detail-item"><div class="detail-label">KYC</div><div class="detail-value">${kycBadge(u.kycStatus)}</div></div>
      <div class="detail-item"><div class="detail-label">Risk</div><div class="detail-value">${riskBadge(u.riskLevel)}</div></div>
      <div class="detail-item"><div class="detail-label">Tags</div><div class="detail-value">${u.tags.map(t=>`<span class="badge blue">${t}</span>`).join(' ')||'—'}</div></div>
    </div>
    <div style="font-weight:600;margin:12px 0 8px">Account Balances</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${Object.entries(u.accounts).map(([k,a])=>`
        <div class="detail-item">
          <div class="detail-label">${k}</div>
          <div class="detail-value text-blue">${formatCurrency(a.balance)}</div>
        </div>
      `).join('')}
    </div>
    <div style="font-weight:600;margin-bottom:8px">Active Loans: ${loans.length} | Transactions: ${txns.length}</div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      ${u.status==='Active'?`<button class="btn btn-danger" onclick="lockUser('${u.id}');closeModal()">Lock Account</button>`:`<button class="btn btn-success" onclick="unlockUser('${u.id}');closeModal()">Unlock Account</button>`}
    </div>
  `);
}

function showEditUser(id) {
  const u = DB.users.find(u=>u.id===id);
  if(!u) return;
  showModal(`
    <div class="modal-title">Edit User — ${u.fullName}</div>
    <div class="form-row">
      <div class="field-group"><label>First Name</label><input type="text" id="eu_fn" value="${u.firstName}"></div>
      <div class="field-group"><label>Last Name</label><input type="text" id="eu_ln" value="${u.lastName}"></div>
    </div>
    <div class="form-row">
      <div class="field-group"><label>Email</label><input type="email" id="eu_em" value="${u.email}"></div>
      <div class="field-group"><label>Status</label>
        <select id="eu_st">
          <option ${u.status==='Active'?'selected':''}>Active</option>
          <option ${u.status==='Locked'?'selected':''}>Locked</option>
          <option ${u.status==='Suspended'?'selected':''}>Suspended</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field-group"><label>Credit Score (300-850)</label><input type="number" id="eu_cs" value="${u.creditScore}" min="300" max="850"></div>
      <div class="field-group"><label>KYC Status</label>
        <select id="eu_kyc">
          <option ${u.kycStatus==='Verified'?'selected':''}>Verified</option>
          <option ${u.kycStatus==='Pending'?'selected':''}>Pending</option>
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditUser('${u.id}')">Save Changes</button>
    </div>
  `);
}

function saveEditUser(id) {
  const u = DB.users.find(u=>u.id===id);
  if(!u) return;
  u.firstName = document.getElementById('eu_fn').value;
  u.lastName = document.getElementById('eu_ln').value;
  u.fullName = `${u.firstName} ${u.lastName}`;
  u.email = document.getElementById('eu_em').value;
  u.status = document.getElementById('eu_st').value;
  u.creditScore = parseInt(document.getElementById('eu_cs').value);
  u.kycStatus = document.getElementById('eu_kyc').value;
  if(u.status !== 'Locked') u.failedLogins = 0;
  addLog('admin','admin',`User ${u.fullName} edited`);
  toast('User updated','success');
  saveDB();
  closeModal();
  renderPage('users');
}

function showLoanDetail(id) {
  const l = DB.loans.find(l=>l.id===id);
  if(!l) return;
  showModal(`
    <div class="modal-title">Loan Detail — ${l.id}</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Borrower</div><div class="detail-value">${l.userName}</div></div>
      <div class="detail-item"><div class="detail-label">Type</div><div class="detail-value"><span class="badge blue">${l.type}</span></div></div>
      <div class="detail-item"><div class="detail-label">Principal</div><div class="detail-value fw-600">${formatCurrency(l.principal)}</div></div>
      <div class="detail-item"><div class="detail-label">Remaining</div><div class="detail-value text-red">${formatCurrency(l.remainingBalance)}</div></div>
      <div class="detail-item"><div class="detail-label">Monthly Payment</div><div class="detail-value">${formatCurrency(l.monthlyPayment)}</div></div>
      <div class="detail-item"><div class="detail-label">Interest Rate</div><div class="detail-value">${l.interestRate.toFixed(2)}%</div></div>
      <div class="detail-item"><div class="detail-label">Term</div><div class="detail-value">${l.termMonths} months</div></div>
      <div class="detail-item"><div class="detail-label">Paid</div><div class="detail-value">${l.paidMonths} months</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${loanStatusBadge(l.status)}</div></div>
      <div class="detail-item"><div class="detail-label">Start Date</div><div class="detail-value">${formatDate(l.startDate)}</div></div>
      <div class="detail-item"><div class="detail-label">End Date</div><div class="detail-value">${formatDate(l.endDate)}</div></div>
      ${l.latePenalties>0?`<div class="detail-item"><div class="detail-label">Late Penalties</div><div class="detail-value text-red">${formatCurrency(l.latePenalties)}</div></div>`:''}
    </div>
    <div style="margin-top:12px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px">Repayment Progress</div>
      <div style="background:var(--bg2);border-radius:8px;height:10px">
        <div style="width:${Math.min(100,Math.round(l.paidMonths/l.termMonths*100))}%;height:100%;background:var(--green);border-radius:8px"></div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">${Math.round(l.paidMonths/l.termMonths*100)}% paid</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      ${l.status==='Overdue'?`<button class="btn btn-primary" onclick="restructureLoan('${l.id}');closeModal()">Restructure</button>`:''}
      ${l.status==='Active'?`<button class="btn btn-success" onclick="markLoanPaid('${l.id}');closeModal()">Mark as Paid</button>`:''}
    </div>
  `);
}

function lockUser(id) {
  const u = DB.users.find(u=>u.id===id);
  if(u) {
    u.status='Locked';
    addLog('admin','admin',`User ${u.fullName} locked`);
    toast(u.fullName+' locked','warning');
    saveDB();
    renderPage(currentPage);
  }
}

function unlockUser(id) {
  const u = DB.users.find(u=>u.id===id);
  if(u) {
    u.status='Active';
    u.failedLogins=0;
    addLog('admin','admin',`User ${u.fullName} unlocked`);
    toast(u.fullName+' unlocked','success');
    saveDB();
    renderPage(currentPage);
  }
}

function restructureLoan(id) {
  const l = DB.loans.find(l=>l.id===id);
  if(l) {
    l.status='Restructured';
    l.termMonths += 12;
    l.monthlyPayment *= 0.85;
    l.latePenalties=0;
    addLog('admin','loan',`Loan ${id} restructured`);
    toast('Loan restructured','success');
    saveDB();
    renderPage(currentPage);
  }
}

function markLoanPaid(id) {
  const l = DB.loans.find(l=>l.id===id);
  if(l) {
    const u = DB.users.find(u=>u.id===l.userId);
    l.status='Paid'; l.remainingBalance=0;
    if(u) { u.creditScore = Math.min(850, u.creditScore+20); }
    addLog('admin','loan',`Loan ${id} marked as paid`);
    toast('Loan marked as paid','success');
    saveDB();
    renderPage(currentPage);
  }
}

// ─── UTILITIES ────────────────────────────────────────────────────
function formatCurrency(n) {
  return '₱' + (n||0).toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatDate(d) {
  if(!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric', hour:'2-digit', minute:'2-digit'});
}

function statusBadge(s) {
  const map = { Completed:'green', Pending:'orange', Failed:'red' };
  return `<span class="badge ${map[s]||'gray'}">${s}</span>`;
}

function userStatusBadge(s) {
  const map = { Active:'green', Locked:'red', Suspended:'orange' };
  return `<span class="badge ${map[s]||'gray'}">${s}</span>`;
}

function kycBadge(s) {
  return `<span class="badge ${s==='Verified'?'green':'orange'}">${s}</span>`;
}

function riskBadge(r) {
  if(!r) return '<span class="badge gray">—</span>';
  const map = {Low:'risk-low',Medium:'risk-med',High:'risk-high'};
  return `<span class="risk-indicator ${map[r]||'risk-low'}">${r}</span>`;
}

function loanStatusBadge(s) {
  const map = { Active:'blue', Paid:'green', Overdue:'red', Restructured:'orange' };
  return `<span class="badge ${map[s]||'gray'}">${s}</span>`;
}

function creditBadge(score) {
  const ct = creditTier(score);
  return `<span class="badge ${ct.color}">${score}</span>`;
}

function generateRandomTransactions() {
  const active = DB.users.filter(u=>u.status==='Active');
  if(!active.length) { toast('No active users','error'); return; }
  for(let i=0;i<50;i++) {
    const u = randItem(active);
    const types = ['Deposit','Withdrawal','Transfer','ATM','Card Payment'];
    const type = randItem(types);
    const amount = randFloat(10, 5000);
    doTransaction(u, type, amount, randItem(['savings','checking','ewallet']), true);
  }
  toast('50 random transactions generated','success');
  saveDB();
  renderPage(currentPage);
}

function exportCSV(type='all') {
  let rows = [];
  let filename = 'nexabank_export.csv';
  
  if(type==='users' || type==='all') {
    rows.push(['--- USERS ---']);
    rows.push(['ID','Name','Account#','Email','CreditScore','Status','KYC','Created']);
    DB.users.forEach(u=>rows.push([u.id,u.fullName,u.accountNumber,u.email,u.creditScore,u.status,u.kycStatus,u.createdAt]));
  }
  if(type==='transactions' || type==='all') {
    if(rows.length) rows.push([]);
    rows.push(['--- TRANSACTIONS ---']);
    rows.push(['ID','User','Type','Amount','Account','Status','Date']);
    DB.transactions.forEach(t=>rows.push([t.id,t.userName,t.type,t.amount,t.accountType,t.status,t.date]));
    filename='nexabank_transactions.csv';
  }
  if(type==='logs') {
    rows.push(['ID','Actor','Type','Message','Date']);
    DB.logs.forEach(l=>rows.push([l.id,l.actor,l.type,l.message,l.date]));
    filename='nexabank_logs.csv';
  }
  
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; a.click();
  toast('CSV exported','success');
}

function backupData() {
  const json = JSON.stringify(DB, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='nexabank_backup.json'; a.click();
  toast('Backup downloaded','success');
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const m = document.querySelector('.main-content');
  s.classList.toggle('collapsed');
  if(s.classList.contains('collapsed')) {
    m.style.marginLeft='0';
  } else {
    m.style.marginLeft='var(--sidebar-w)';
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  panel.style.display = panel.style.display==='none' ? 'flex' : 'none';
  if(panel.style.display!=='none') { notifCount=0; updateNotifBadge(); }
}

function clearNotifs() {
  DB.notifications = [];
  notifCount = 0;
  updateNotifBadge();
  renderNotifList();
}

function renderNotifList() {
  const el = document.getElementById('notifList');
  if(!el) return;
  if(!DB.notifications.length) { el.innerHTML='<div class="empty-state" style="padding:20px">No notifications</div>'; return; }
  el.innerHTML = DB.notifications.slice(0,20).map(n=>`
    <div class="notif-item ${n.type}">
      <div class="ni-title">${n.title}</div>
      <div style="font-size:12px;color:var(--text2);margin:2px 0">${n.message}</div>
      <div class="ni-time">${formatDate(n.date)}</div>
    </div>
  `).join('');
}

// ─── BOOT ─────────────────────────────────────────────────────────
function boot() {
  // Show loading screen
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = `
    <div class="loading-logo">⬡ NexaBank</div>
    <div class="loading-bar"><div class="loading-progress"></div></div>
    <div class="loading-text" id="loadingText">Initializing system...</div>
  `;
  document.body.prepend(loadingEl);

  const msgs = ['Loading user database...','Checking transactions...','Validating loans...','System ready!'];
  let mi = 0;
  const msgInterval = setInterval(()=>{
    const el = document.getElementById('loadingText');
    if(el && mi < msgs.length) el.textContent = msgs[mi++];
  }, 600);

  setTimeout(()=>{
    clearInterval(msgInterval);
    loadingEl.remove();

    // Load or generate data
    const loaded = loadDB();
    if(!loaded || !DB.initialized) {
      document.getElementById('loadingText') && (document.getElementById('loadingText').textContent = 'Generating 300 users...');
      generateInitialData();
    } else {
      simDate = new Date(DB.simDate || Date.now());
    }

    // Apply saved theme
    if(DB.settings.theme) {
      document.documentElement.setAttribute('data-theme', DB.settings.theme);
      if(DB.settings.theme === 'dark') {
        const btn = document.querySelector('.theme-toggle');
        if(btn) btn.textContent = '☀️';
      }
    }

    addNotif('System Ready','NexaBank simulation loaded successfully','info');
    renderNotifList();
  }, 2600);
}

boot();
