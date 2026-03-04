/**
 * Mock Linux Shell — simulates a real SSH session on a VM
 * Supports ~40 common Linux commands with realistic ANSI-colored output
 */

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const A = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue:  '\x1b[44m',
};
const b  = (s) => `${A.bold}${s}${A.reset}`;
const c  = (color, s) => `${A[color]}${s}${A.reset}`;

class MockShell {
  constructor(vm, user) {
    this.vm       = vm;
    this.authUser = user;
    this.cwd      = '/root';
    this.hostname = vm.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    this.history  = [];
    this.histIdx  = -1;
    this.inputBuf = '';

    // Services state
    this.services = {
      nginx:      { active: false, enabled: false },
      mysql:      { active: false, enabled: false },
      postgresql: { active: false, enabled: false },
      ssh:        { active: true,  enabled: true  },
      cron:       { active: true,  enabled: true  },
      docker:     { active: false, enabled: false },
    };

    // Simulated installed packages
    this.installed = new Set(['bash', 'curl', 'wget', 'git', 'vim', 'nano', 'htop', 'net-tools', 'openssh-server', 'cron']);

    // Simulated filesystem
    this.fs = this._buildFs();
  }

  _buildFs() {
    const vm = this.vm;
    return {
      '/':                          { type: 'd', c: ['bin','boot','dev','etc','home','lib','opt','proc','root','run','srv','sys','tmp','usr','var'] },
      '/root':                      { type: 'd', c: ['.bashrc', '.profile', '.ssh', 'deploy.sh'] },
      '/root/.ssh':                 { type: 'd', c: ['authorized_keys', 'known_hosts'] },
      '/root/.bashrc':              { type: 'f', content: `# ~/.bashrc\nexport PS1="\\u@\\h:\\w# "\nexport HISTSIZE=1000\nalias ll='ls -la --color=auto'\nalias l='ls -l --color=auto'\nalias la='ls -la --color=auto'` },
      '/root/.profile':             { type: 'f', content: `# ~/.profile\n[ -f ~/.bashrc ] && . ~/.bashrc` },
      '/root/deploy.sh':            { type: 'f', content: `#!/bin/bash\n# Auto-deploy script\necho "Starting deployment..."\ngit pull origin main\nnpm install --production\npm2 restart app\necho "Deploy complete!"` },
      '/root/.ssh/authorized_keys': { type: 'f', content: `ssh-rsa AAAA... mts-hackathon-key` },
      '/etc':                       { type: 'd', c: ['nginx','mysql','hosts','hostname','os-release','resolv.conf','passwd','crontab','fstab'] },
      '/etc/hostname':              { type: 'f', content: this.hostname },
      '/etc/hosts':                 { type: 'f', content: `127.0.0.1 localhost\n127.0.1.1 ${this.hostname}\n${vm.ip} ${this.hostname}\n::1 localhost ip6-localhost ip6-loopback` },
      '/etc/os-release':            { type: 'f', content: `NAME="${vm.os}"\nVERSION="1.0 LTS"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="${vm.os} LTS"\nHOME_URL="https://www.ubuntu.com/"\n` },
      '/etc/resolv.conf':           { type: 'f', content: `nameserver 8.8.8.8\nnameserver 1.1.1.1` },
      '/etc/passwd':                { type: 'f', content: `root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nubuntu:x:1000:1000::/home/ubuntu:/bin/bash` },
      '/etc/fstab':                 { type: 'f', content: `# /etc/fstab\nUUID=abc123 / ext4 defaults 0 1\nUUID=def456 /boot ext4 defaults 0 2` },
      '/etc/nginx':                 { type: 'd', c: ['nginx.conf','sites-available','sites-enabled'] },
      '/etc/nginx/nginx.conf':      { type: 'f', content: `user www-data;\nworker_processes auto;\nevents { worker_connections 1024; }\nhttp {\n  include /etc/nginx/sites-enabled/*;\n}` },
      '/etc/mysql':                 { type: 'd', c: ['my.cnf'] },
      '/etc/mysql/my.cnf':          { type: 'f', content: `[mysqld]\nbind-address = 0.0.0.0\nmax_connections = 150\ninnodb_buffer_pool_size = 128M` },
      '/var':                       { type: 'd', c: ['log','www','cache','run','lib'] },
      '/var/log':                   { type: 'd', c: ['nginx','syslog','auth.log','kern.log','dpkg.log'] },
      '/var/log/syslog':            { type: 'f', content: `Mar  4 12:00:01 ${this.hostname} CRON[1234]: (root) CMD (backup.sh)\nMar  4 12:05:23 ${this.hostname} sshd[5678]: Accepted publickey for root` },
      '/var/log/auth.log':          { type: 'f', content: `Mar  4 12:05:23 ${this.hostname} sshd[5678]: Accepted publickey for root from ${vm.ip}\nMar  4 12:05:23 ${this.hostname} sshd[5678]: pam_unix(sshd:session): session opened for root` },
      '/var/www':                   { type: 'd', c: ['html'] },
      '/var/www/html':              { type: 'd', c: ['index.html', 'index.nginx-debian.html'] },
      '/var/www/html/index.html':   { type: 'f', content: `<!DOCTYPE html>\n<html>\n<head><title>Welcome to ${this.hostname}!</title></head>\n<body><h1>Welcome to ${this.hostname}!</h1><p>Powered by nginx.</p></body>\n</html>` },
      '/home':                      { type: 'd', c: ['ubuntu'] },
      '/home/ubuntu':               { type: 'd', c: ['.bashrc', 'projects', 'logs'] },
      '/home/ubuntu/projects':      { type: 'd', c: ['webapp', 'api'] },
      '/home/ubuntu/projects/webapp': { type: 'd', c: ['index.js', 'package.json', 'README.md'] },
      '/home/ubuntu/projects/webapp/package.json': { type: 'f', content: `{\n  "name": "webapp",\n  "version": "1.0.0",\n  "scripts": { "start": "node index.js" },\n  "dependencies": { "express": "^4.18.0" }\n}` },
      '/tmp':                       { type: 'd', c: [] },
      '/opt':                       { type: 'd', c: [] },
      '/proc':                      { type: 'd', c: ['cpuinfo', 'meminfo', 'version', 'uptime'] },
      '/proc/version':              { type: 'f', content: `Linux version 6.1.0-17-amd64 (debian-kernel@lists.debian.org) (gcc-12 (Debian 12.2.0) 12.2.0) #1 SMP PREEMPT_DYNAMIC` },
      '/proc/uptime':               { type: 'f', content: `86400.00 172800.00` },
    };
  }

  // ─── Prompt ──────────────────────────────────────────────────────────────────
  prompt() {
    const dir = this.cwd === '/root' ? '~' : this.cwd;
    return `${c('green', 'root')}${c('white', '@')}${c('cyan', this.hostname)}${c('white', ':')}${c('blue', dir)}${c('white', '# ')}`;
  }

  // ─── Welcome banner ──────────────────────────────────────────────────────────
  banner() {
    const vm = this.vm;
    const lines = [
      '',
      `${A.green}${A.bold}  ██████╗ ██████╗ ███╗   ██╗███╗   ██╗███████╗ ██████╗████████╗${A.reset}`,
      `${A.red}${A.bold}   ██████╗  ██████╗ ██╗   ██╗██╗   ██╗    ██╗  ██╔══██╗██╔════╝${A.reset}`,
      '',
      `${A.bold}${A.white}  MTS Cloud — IaaS Platform${A.reset}`,
      `${A.gray}  ──────────────────────────────────────────────────${A.reset}`,
      `  VM:       ${c('cyan', vm.name)}`,
      `  OS:       ${c('yellow', vm.os)}`,
      `  IP:       ${c('cyan', vm.ip)}`,
      `  CPU:      ${c('green', vm.cpu + ' vCPU')}`,
      `  RAM:      ${c('green', vm.ram + ' GB')}`,
      `  Disk:     ${c('green', vm.disk + ' GB')}`,
      `  Status:   ${vm.status === 'running' ? c('green', '● running') : c('red', '● stopped')}`,
      `${A.gray}  ──────────────────────────────────────────────────${A.reset}`,
      `  ${c('gray', 'Type')} ${b('help')} ${c('gray', 'for available commands')}`,
      '',
    ];
    return lines.join('\r\n');
  }

  // ─── Command processing ──────────────────────────────────────────────────────
  run(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';

    this.history.unshift(trimmed);
    this.histIdx = -1;

    const parts  = trimmed.split(/\s+/);
    const cmd    = parts[0];
    const args   = parts.slice(1);
    const argStr = args.join(' ');

    switch (cmd) {
      // ── Navigation ────────────────────────────────────────────────────────
      case 'pwd':   return this.cwd;
      case 'cd':    return this._cd(args[0]);
      case 'ls':    return this._ls(args);
      case 'll':    return this._ls(['-la', ...args]);
      case 'la':    return this._ls(['-la', ...args]);
      case 'l':     return this._ls(['-l', ...args]);

      // ── File ops ──────────────────────────────────────────────────────────
      case 'cat':     return this._cat(args[0]);
      case 'less':    return this._cat(args[0]);
      case 'more':    return this._cat(args[0]);
      case 'head':    return this._head(args);
      case 'tail':    return this._tail(args);
      case 'mkdir':   return this._mkdir(args[0]);
      case 'touch':   return this._touch(args[0]);
      case 'rm':      return this._rm(args);
      case 'cp':      return this._cp(args);
      case 'mv':      return this._mv(args);
      case 'echo':    return this._echo(argStr);
      case 'nano':
      case 'vim':
      case 'vi':      return `${c('yellow', `[${cmd}]`)} Редактор недоступен в web-терминале.\r\nИспользуйте echo для записи: ${c('cyan', `echo "content" > filename`)}`;
      case 'which':   return this._which(args[0]);
      case 'find':    return this._find(args);

      // ── System info ───────────────────────────────────────────────────────
      case 'whoami':   return 'root';
      case 'id':       return 'uid=0(root) gid=0(root) groups=0(root)';
      case 'hostname': return this.hostname;
      case 'uname':    return this._uname(args);
      case 'uptime':   return this._uptime();
      case 'date':     return new Date().toString();
      case 'w':        return this._w();
      case 'env':      return this._env();

      // ── Resources ─────────────────────────────────────────────────────────
      case 'free':   return this._free(args);
      case 'df':     return this._df(args);
      case 'top':    return this._top();
      case 'htop':   return this._top();
      case 'ps':     return this._ps(args);
      case 'kill':   return this._kill(args);
      case 'nproc':  return this.vm.cpu;

      // ── Network ───────────────────────────────────────────────────────────
      case 'ip':        return this._ip(args);
      case 'ifconfig':  return this._ifconfig();
      case 'netstat':   return this._netstat();
      case 'ss':        return this._netstat();
      case 'ping':      return this._ping(args[0]);
      case 'curl':      return this._curl(argStr);
      case 'wget':      return c('green', `--${new Date().toISOString()}-- ${argStr}\nResolving... Connecting... 200 OK\nLength: 1234 (1.2K)\nSaved: '${args[args.length-1] || 'index.html'}' [1234/1234]`);
      case 'nslookup':  return this._nslookup(args[0]);
      case 'dig':       return this._nslookup(args[0]);

      // ── Package management ────────────────────────────────────────────────
      case 'apt':
      case 'apt-get':    return this._apt(args);
      case 'dpkg':       return this._dpkg(args);
      case 'pip':
      case 'pip3':       return `${c('green', 'Successfully installed')} ${args.slice(1).join(' ') || '<package>'}`;

      // ── Services ──────────────────────────────────────────────────────────
      case 'systemctl':  return this._systemctl(args);
      case 'service':    return this._service(args);

      // ── Docker ────────────────────────────────────────────────────────────
      case 'docker':  return this._docker(args);

      // ── Git ───────────────────────────────────────────────────────────────
      case 'git':  return this._git(args);

      // ── Misc ──────────────────────────────────────────────────────────────
      case 'clear':     return '\x1bc';
      case 'history':   return this._history();
      case 'help':      return this._help();
      case 'man':       return `${c('yellow', 'man:')} Страницы руководства недоступны. Попробуйте ${b(args[0] + ' --help')}`;
      case 'sudo':      return this.run(args.join(' ')); // already root
      case 'su':        return c('green', 'Already root.');
      case 'exit':
      case 'logout':    return '__EXIT__';
      case 'reboot':
      case 'shutdown':  return `${c('yellow', 'Broadcast message:')} The system will ${cmd} now!\r\n${c('red', 'Connection closed.')}`;

      // Node.js / Python / etc
      case 'node':      return this._node(argStr);
      case 'npm':       return this._npm(args);
      case 'python':
      case 'python3':   return this._python(argStr);
      case 'php':       return `PHP ${c('cyan', '8.1.2')} (cli)`;
      case 'java':      return args[0] === '-version' ? `openjdk version "17.0.7" 2023-04-18\nOpenJDK Runtime Environment` : c('red', 'Usage: java -version');

      // Versions
      case 'nginx':         return args[0] === '-v' || args[0] === '-V' ? `nginx version: nginx/1.24.0 (Ubuntu)` : `${c('yellow', 'nginx: [warn]')} Use systemctl to manage nginx service`;
      case 'mysql':         return `${c('cyan', 'mysql')} Ver 8.0.32 Distrib 8.0.32`;
      case 'psql':          return `psql (PostgreSQL) 15.2`;
      case 'redis-cli':     return `Redis server v=7.0.9`;

      default:
        // Try to find as script/binary
        if (trimmed.startsWith('./') || trimmed.startsWith('/')) {
          return this._runScript(trimmed);
        }
        return `${c('red', `bash: ${cmd}: command not found`)}\r\n${A.gray}Hint: try ${b('apt install ' + cmd)} to install it${A.reset}`;
    }
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  _cd(target) {
    if (!target || target === '~' || target === '/root') { this.cwd = '/root'; return ''; }
    if (target === '-') { return this.cwd; }

    let newPath = target.startsWith('/') ? target : `${this.cwd}/${target}`;
    // Resolve .. 
    const parts = newPath.split('/').filter(Boolean);
    const resolved = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else if (p !== '.') resolved.push(p);
    }
    newPath = '/' + resolved.join('/') || '/';

    if (this.fs[newPath] && this.fs[newPath].type === 'd') {
      this.cwd = newPath;
      return '';
    }
    if (this.fs[newPath] && this.fs[newPath].type === 'f') {
      return `bash: cd: ${target}: Not a directory`;
    }
    return `bash: cd: ${target}: No such file or directory`;
  }

  _ls(args) {
    const longFlag = args.includes('-l') || args.includes('-la') || args.includes('-al') || args.includes('-lh');
    const allFlag  = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const pathArg  = args.find(a => !a.startsWith('-')) || this.cwd;
    
    let targetPath = pathArg.startsWith('/') ? pathArg : `${this.cwd}/${pathArg}`;
    if (pathArg === '.' || !pathArg) targetPath = this.cwd;

    const entry = this.fs[targetPath];
    if (!entry) return `ls: cannot access '${pathArg}': No such file or directory`;

    let items = entry.type === 'd' ? [...(entry.c || [])] : [targetPath.split('/').pop()];
    if (allFlag) items = ['.', '..', ...items];
    else items = items.filter(i => !i.startsWith('.'));

    if (!longFlag) {
      const colored = items.map(item => {
        const fullPath = targetPath + '/' + item;
        const isDir = this.fs[fullPath]?.type === 'd' || ['bin','boot','dev','etc','home','lib','opt','proc','root','run','srv','sys','tmp','usr','var'].includes(item);
        if (item === '.' || item === '..') return c('blue', item);
        if (item.endsWith('.sh')) return c('green', item);
        if (isDir) return `${A.bold}${A.blue}${item}${A.reset}`;
        if (item.startsWith('.')) return c('gray', item);
        return item;
      });
      return colored.join('  ');
    }

    const now = new Date();
    const dateStr = `${now.toLocaleString('en', {month:'short'})} ${String(now.getDate()).padStart(2)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const lines = [`total ${items.length * 4}`];
    
    for (const item of items) {
      const fullPath = targetPath + '/' + item;
      const e = this.fs[fullPath];
      const isDir = item === '.' || item === '..' || e?.type === 'd' || ['bin','boot','dev','etc','home','lib','opt','proc','root','run','srv','sys','tmp','usr','var'].includes(item);
      const type = isDir ? 'd' : '-';
      const perms = isDir ? 'rwxr-xr-x' : (item.endsWith('.sh') ? 'rwxr-xr-x' : 'rw-r--r--');
      const size = e?.content ? String(e.content.length).padStart(6) : (isDir ? '  4096' : '      0');
      
      let coloredName = item;
      if (item === '.' || item === '..') coloredName = c('blue', item);
      else if (isDir) coloredName = `${A.bold}${A.blue}${item}${A.reset}`;
      else if (item.endsWith('.sh')) coloredName = c('green', item);
      else if (item.startsWith('.')) coloredName = c('gray', item);

      lines.push(`${type}${perms} 1 root root ${size} ${dateStr} ${coloredName}`);
    }
    return lines.join('\r\n');
  }

  _cat(filepath) {
    if (!filepath) return 'cat: missing file operand';
    const fullPath = filepath.startsWith('/') ? filepath : `${this.cwd}/${filepath}`;
    const entry = this.fs[fullPath];
    if (!entry) return `cat: ${filepath}: No such file or directory`;
    if (entry.type === 'd') return `cat: ${filepath}: Is a directory`;
    return entry.content || '';
  }

  _head(args) {
    const n = parseInt(args.find(a => a.startsWith('-'))?.slice(1)) || 10;
    const file = args.find(a => !a.startsWith('-'));
    const content = this._cat(file);
    return content.split('\n').slice(0, n).join('\r\n');
  }

  _tail(args) {
    const n = parseInt(args.find(a => a.startsWith('-') && !isNaN(parseInt(a.slice(1))))?.slice(1)) || 10;
    const file = args.find(a => !a.startsWith('-'));
    if (!file) return 'tail: missing file operand';
    const content = this._cat(file);
    const lines = content.split('\n');
    return lines.slice(-n).join('\r\n');
  }

  _mkdir(name) {
    if (!name) return 'mkdir: missing operand';
    const fullPath = name.startsWith('/') ? name : `${this.cwd}/${name}`;
    this.fs[fullPath] = { type: 'd', c: [] };
    const parent = this.fs[this.cwd];
    if (parent && parent.c) parent.c.push(name);
    return '';
  }

  _touch(name) {
    if (!name) return 'touch: missing file operand';
    const fullPath = name.startsWith('/') ? name : `${this.cwd}/${name}`;
    this.fs[fullPath] = { type: 'f', content: '' };
    const parent = this.fs[this.cwd];
    if (parent && parent.c && !parent.c.includes(name)) parent.c.push(name);
    return '';
  }

  _rm(args) {
    const name = args.find(a => !a.startsWith('-'));
    if (!name) return 'rm: missing operand';
    if (name === '/' || name === '/root') return `rm: refusing to remove '/' or '/root'`;
    const fullPath = name.startsWith('/') ? name : `${this.cwd}/${name}`;
    if (this.fs[fullPath]) {
      delete this.fs[fullPath];
      return '';
    }
    return `rm: cannot remove '${name}': No such file or directory`;
  }

  _cp(args) {
    const [src, dst] = args.filter(a => !a.startsWith('-'));
    if (!src || !dst) return 'cp: missing file operand';
    const srcPath = src.startsWith('/') ? src : `${this.cwd}/${src}`;
    const dstPath = dst.startsWith('/') ? dst : `${this.cwd}/${dst}`;
    if (!this.fs[srcPath]) return `cp: cannot stat '${src}': No such file or directory`;
    this.fs[dstPath] = { ...this.fs[srcPath] };
    return '';
  }

  _mv(args) {
    const [src, dst] = args.filter(a => !a.startsWith('-'));
    if (!src || !dst) return 'mv: missing file operand';
    this._cp([src, dst]);
    this._rm([src]);
    return '';
  }

  _echo(text) {
    // Handle variable expansion (basic)
    return text.replace(/\$HOSTNAME/g, this.hostname)
               .replace(/\$USER/g, 'root')
               .replace(/\$HOME/g, '/root')
               .replace(/\$PWD/g, this.cwd)
               .replace(/\$([\w]+)/g, (_, v) => process.env[v] || '');
  }

  _which(cmd) {
    const paths = { bash:'/bin/bash', sh:'/bin/sh', ls:'/bin/ls', cat:'/bin/cat', echo:'/bin/echo', grep:'/bin/grep',
      nginx:'/usr/sbin/nginx', mysql:'/usr/bin/mysql', node:'/usr/bin/node', npm:'/usr/bin/npm',
      python3:'/usr/bin/python3', git:'/usr/bin/git', curl:'/usr/bin/curl', wget:'/usr/bin/wget',
      docker:'/usr/bin/docker', vim:'/usr/bin/vim', nano:'/bin/nano', htop:'/usr/bin/htop' };
    return paths[cmd] || `which: no ${cmd} in (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin)`;
  }

  _find(args) {
    const path = args[0] || '.';
    return `${path}/index.js\n${path}/package.json\n${path}/README.md`;
  }

  _uname(args) {
    const full = args.includes('-a');
    if (full) return `Linux ${this.hostname} 6.1.0-17-amd64 #1 SMP PREEMPT_DYNAMIC Sat Mar  2 02:06:46 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux`;
    if (args.includes('-r')) return '6.1.0-17-amd64';
    if (args.includes('-m')) return 'x86_64';
    if (args.includes('-n')) return this.hostname;
    return 'Linux';
  }

  _uptime() {
    const secs = 86400 + Math.floor(Math.random() * 3600);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const cpuStr = Array.from({length: parseInt(this.vm.cpu)}, () => (Math.random() * 0.5).toFixed(2)).join(', ');
    const now = new Date().toLocaleTimeString('en');
    return ` ${now} up ${h}:${String(m).padStart(2,'0')},  1 user,  load average: ${cpuStr}`;
  }

  _w() {
    const now = new Date().toLocaleTimeString('en');
    return ` ${now} up 1 day,  1:23,  1 user,  load average: 0.12, 0.08, 0.05\r\n` +
      `${b('USER')}     TTY    FROM           LOGIN@   IDLE  JCPU   PCPU WHAT\r\n` +
      `root     pts/0  ${this.authUser?.email || '10.0.0.1'}  ${now}   0.00s  0.04s  0.01s w`;
  }

  _env() {
    return [
      `HOME=/root`, `USER=root`, `SHELL=/bin/bash`,
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      `TERM=xterm-256color`, `HOSTNAME=${this.hostname}`,
      `LANG=en_US.UTF-8`, `PWD=${this.cwd}`,
    ].join('\r\n');
  }

  _free(args) {
    const total = parseInt(this.vm.ram) * 1024;
    const used  = Math.floor(total * 0.6);
    const free  = total - used;
    const buff  = Math.floor(total * 0.15);
    const avail = free + buff;

    if (args.includes('-h')) {
      const f = (n) => n >= 1024 ? (n/1024).toFixed(1)+'G' : n+'M';
      return `              total        used        free      shared  buff/cache   available\r\n` +
             `Mem:      ${f(total).padStart(7)}     ${f(used).padStart(7)}     ${f(free).padStart(7)}         ${f(Math.floor(total*0.01)).padStart(4)}     ${f(buff).padStart(7)}     ${f(avail).padStart(7)}\r\n` +
             `Swap:     ${f(total/2).padStart(7)}     ${f(Math.floor(used*0.05)).padStart(7)}     ${f(total/2-Math.floor(used*0.05)).padStart(7)}`;
    }
    return `              total        used        free      shared  buff/cache   available\r\n` +
           `Mem:        ${String(total*1024).padStart(9)}  ${String(used*1024).padStart(10)}  ${String(free*1024).padStart(10)}      ${String(Math.floor(total*10)).padStart(7)}  ${String(buff*1024).padStart(10)}  ${String(avail*1024).padStart(10)}\r\n` +
           `Swap:       ${String(total*512).padStart(9)}     ${String(0).padStart(10)}  ${String(total*512).padStart(10)}`;
  }

  _df(args) {
    const human = args.includes('-h');
    const disk  = parseInt(this.vm.disk);
    const used  = Math.floor(disk * 0.35);
    const avail = disk - used;
    const pct   = Math.round(used / disk * 100);

    if (human) {
      return `Filesystem      Size  Used Avail Use% Mounted on\r\n` +
             `/dev/sda1       ${disk}G  ${used}G  ${avail}G  ${pct}% /\r\n` +
             `tmpfs           ${Math.floor(parseInt(this.vm.ram)/2)}M     0  ${Math.floor(parseInt(this.vm.ram)/2)}M   0% /dev/shm\r\n` +
             `tmpfs           512M  8.4M  504M   2% /run`;
    }
    return `Filesystem     1K-blocks    Used Available Use% Mounted on\r\n` +
           `/dev/sda1      ${disk*1048576} ${used*1048576} ${avail*1048576}  ${pct}% /`;
  }

  _top() {
    const cpu = parseInt(this.vm.cpu);
    const ram = parseInt(this.vm.ram) * 1024;
    const usedMem = Math.floor(ram * 0.6);
    const lines = [
      `${b('top')} - ${new Date().toLocaleTimeString('en')} up 1 day,  1:23,  1 user,  load average: 0.12, 0.08`,
      `Tasks:  72 total,   1 running,  71 sleeping,   0 stopped,   0 zombie`,
      `${c('cyan', '%Cpu(s)')}: ${(Math.random()*20).toFixed(1)} us,  ${(Math.random()*5).toFixed(1)} sy,  0.0 ni, ${(70+Math.random()*20).toFixed(1)} id,  0.0 wa`,
      `${c('cyan', 'MiB Mem')}: ${ram.toFixed(1)} total, ${(ram-usedMem).toFixed(1)} free, ${usedMem.toFixed(1)} used`,
      '',
      `${b('  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND')}`,
    ];
    const processes = [
      [1,     'root',  20, 0, '167980', '10132', '8088', 'S', '0.0', '0.3', '0:02.45', 'systemd'],
      [856,   'root',  20, 0, '108048',  '3400',  '2800', 'S', '0.0', '0.1', '0:00.12', 'sshd'],
      [1124,  'www-data', 20, 0, '56832', '5200',  '3100', 'S', '0.3', '0.2', '0:01.30', 'nginx'],
      [2341,  'root',  20, 0, '890432', '45200', '12000', 'S', '2.1', '1.4', '1:23.10', 'node'],
      [3890,  'root',  20, 0,  '17976',  '3200',  '2800', 'R', '0.0', '0.1', '0:00.02', 'top'],
    ];
    processes.forEach(([pid, user, pr, ni, virt, res, shr, s, cpu, mem, time, cmd]) => {
      const cpuColor = parseFloat(cpu.toString()) > 1 ? A.yellow : '';
      lines.push(`${String(pid).padStart(5)} ${user.padEnd(9)} ${String(pr).padStart(2)} ${String(ni).padStart(3)} ${String(virt).padStart(7)} ${String(res).padStart(6)} ${String(shr).padStart(6)} ${s} ${cpuColor}${String(cpu).padStart(5)}${A.reset} ${String(mem).padStart(5)}  ${time} ${c('cyan', cmd)}`);
    });
    lines.push('', `${c('gray', "[Press 'q' to quit — Ctrl+C to exit]")}`);
    return lines.join('\r\n');
  }

  _ps(args) {
    const aux = args.includes('aux') || args.includes('-aux') || args.includes('-ef');
    if (aux) {
      return [
        `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND`,
        `root           1  0.0  0.1 167980 10132 ?        Ss   00:00   0:02 /sbin/init`,
        `root         856  0.0  0.1 108048  3400 ?        Ss   00:01   0:00 sshd: /usr/sbin/sshd`,
        `www-data    1124  0.3  0.2  56832  5200 ?        S    00:02   0:01 nginx: worker process`,
        `root        2341  2.1  1.4 890432 45200 ?        Sl   00:05   1:23 node /home/ubuntu/projects/webapp/index.js`,
        `mysql       2890  0.1  2.8 1823456 92000 ?       Ssl  00:06   0:45 /usr/sbin/mysqld`,
        `root        3456  0.0  0.0  10936  3200 pts/0    S    12:00   0:00 -bash`,
        `root        3890  0.0  0.1  17976  3200 pts/0    R+   12:05   0:00 ps aux`,
      ].join('\r\n');
    }
    return [
      `  PID TTY          TIME CMD`,
      ` 3456 pts/0    00:00:00 bash`,
      ` 3890 pts/0    00:00:00 ps`,
    ].join('\r\n');
  }

  _kill(args) {
    const pid = args.find(a => !a.startsWith('-'));
    if (!pid) return 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec';
    return c('yellow', `Process ${pid} terminated.`);
  }

  _ip(args) {
    if (args[0] === 'addr' || args[0] === 'a') return this._ifconfig();
    if (args[0] === 'route' || args[0] === 'r') {
      return `default via 10.0.0.1 dev eth0 proto dhcp metric 100\r\n10.0.0.0/24 dev eth0 proto kernel scope link src ${this.vm.ip}`;
    }
    return this._ifconfig();
  }

  _ifconfig() {
    return [
      `${b('eth0')}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`,
      `        inet ${c('yellow', this.vm.ip)}  netmask 255.255.255.0  broadcast 10.255.255.255`,
      `        inet6 fe80::1  prefixlen 64  scopeid 0x20<link>`,
      `        RX packets 12543  bytes 15234567 (14.5 MiB)`,
      `        TX packets 8976   bytes 9123456 (8.7 MiB)`,
      '',
      `${b('lo')}: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536`,
      `        inet 127.0.0.1  netmask 255.0.0.0`,
      `        RX packets 1024  bytes 98765 (96.4 KiB)`,
    ].join('\r\n');
  }

  _netstat() {
    return [
      `Active Internet connections (servers and established)`,
      `Proto Recv-Q Send-Q Local Address        Foreign Address      State`,
      `tcp        0      0 0.0.0.0:22           0.0.0.0:*            LISTEN`,
      `tcp        0      0 0.0.0.0:80           0.0.0.0:*            LISTEN`,
      `tcp        0      0 ${this.vm.ip}:22    ${this.authUser?.email||'10.0.0.1'}:54321  ESTABLISHED`,
      `tcp        0      0 127.0.0.1:3306       0.0.0.0:*            LISTEN`,
    ].join('\r\n');
  }

  _ping(host) {
    if (!host) return 'ping: usage error: Destination address required';
    return [
      `PING ${host} (${host}): 56 data bytes`,
      `64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.${Math.floor(Math.random()*900+100)} ms`,
      `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.${Math.floor(Math.random()*900+100)} ms`,
      `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.${Math.floor(Math.random()*900+100)} ms`,
      '',
      `--- ${host} ping statistics ---`,
      `3 packets transmitted, 3 received, 0% packet loss`,
    ].join('\r\n');
  }

  _curl(argStr) {
    if (!argStr) return `curl: try 'curl --help'`;
    const url = argStr.replace(/-[sSkLo]\s*\S*\s*/g, '').trim();
    return `${c('gray', '  % Total    % Received % Xferd')}
  100  1234  100  1234    0     0   5678      0 --:--:-- --:--:-- --:--:--  5678
<!DOCTYPE html><html><body>Response from ${url}</body></html>`;
  }

  _nslookup(host) {
    if (!host) return 'Usage: nslookup hostname';
    return `Server:\t\t8.8.8.8\r\nAddress:\t8.8.8.8#53\r\n\r\nNon-authoritative answer:\r\nName:\t${host}\r\nAddress: 93.184.216.34`;
  }

  _apt(args) {
    const subcmd = args[0];
    const pkg    = args.slice(1).filter(a => !a.startsWith('-')).join(' ');

    if (subcmd === 'update') {
      return [
        `Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease`,
        `Hit:2 http://security.ubuntu.com/ubuntu jammy-security InRelease`,
        `Reading package lists... ${c('green', 'Done')}`,
        `Building dependency tree... ${c('green', 'Done')}`,
        `Reading state information... ${c('green', 'Done')}`,
        `${c('green', '48 packages can be upgraded. Run apt list --upgradable to see them.')}`,
      ].join('\r\n');
    }
    if (subcmd === 'upgrade') {
      return [
        `Reading package lists... ${c('green', 'Done')}`,
        `Calculating upgrade... ${c('green', 'Done')}`,
        `The following packages will be upgraded: 3 upgraded, 0 newly installed.`,
        `${c('green', '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.')}`,
      ].join('\r\n');
    }
    if (subcmd === 'install' && pkg) {
      this.installed.add(pkg);
      // Auto-enable service if it's a known one
      if (this.services[pkg]) this.services[pkg] = { active: true, enabled: true };
      return [
        `Reading package lists... ${c('green', 'Done')}`,
        `Building dependency tree... ${c('green', 'Done')}`,
        `The following NEW packages will be installed: ${c('cyan', pkg)}`,
        `0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.`,
        `Need to get 1,234 kB of archives.`,
        `After this operation, 5,432 kB of additional disk space will be used.`,
        `Selecting previously unselected package ${pkg}.`,
        `Preparing to unpack ./${pkg}_*.deb ...`,
        `Unpacking ${pkg} ...`,
        `Setting up ${pkg} ...`,
        c('green', `Processing triggers for man-db...`),
        '',
        c('green', `✓ Package '${pkg}' installed successfully!`),
      ].join('\r\n');
    }
    if (subcmd === 'remove' && pkg) {
      this.installed.delete(pkg);
      return c('green', `Package '${pkg}' removed successfully.`);
    }
    if (subcmd === 'list') {
      return [...this.installed].map(p => `${c('green', p)}/jammy,now 1.0.0 amd64 [installed]`).join('\r\n');
    }
    return `apt: unknown command '${subcmd}'\r\nUsage: apt [update|upgrade|install|remove|list]`;
  }

  _dpkg(args) {
    if (args[0] === '-l') return [...this.installed].map(p => `ii  ${p.padEnd(30)} 1.0.0    amd64  ${p} package`).join('\r\n');
    return `dpkg: use 'dpkg -l' to list installed packages`;
  }

  _systemctl(args) {
    const [action, svc] = args;
    if (!svc) {
      if (action === 'list-units') {
        return Object.entries(this.services).map(([name, s]) =>
          `  ${s.active ? c('green', '●') : c('gray', '○')} ${name.padEnd(20)} loaded ${s.active ? 'active running' : 'inactive dead'}`
        ).join('\r\n');
      }
      return 'Usage: systemctl [start|stop|restart|status|enable|disable] <service>';
    }
    const service = this.services[svc];
    if (!service && action !== 'start') return `Unit ${svc}.service could not be found.`;

    switch (action) {
      case 'start':
        if (!this.services[svc]) this.services[svc] = { active: false, enabled: false };
        this.services[svc].active = true;
        return c('green', `● ${svc}.service - ${svc} web server\r\n     Started ${svc}.service.`);
      case 'stop':
        if (service) service.active = false;
        return c('yellow', `Stopped ${svc}.service.`);
      case 'restart':
        if (service) service.active = true;
        return c('green', `Restarting ${svc}.service...`);
      case 'enable':
        if (service) service.enabled = true;
        return c('green', `Created symlink → /etc/systemd/system/multi-user.target.wants/${svc}.service.`);
      case 'disable':
        if (service) service.enabled = false;
        return c('yellow', `Removed /etc/systemd/system/multi-user.target.wants/${svc}.service.`);
      case 'status':
        const isActive = service?.active;
        return [
          `${isActive ? c('green', '●') : c('red', '●')} ${svc}.service - ${svc}`,
          `     Loaded: loaded (/lib/systemd/system/${svc}.service; ${service?.enabled ? 'enabled' : 'disabled'})`,
          `     Active: ${isActive ? c('green', 'active (running)') : c('red', 'inactive (dead)')} since ${new Date().toLocaleString('en')}`,
          `    Process: 1124 ExecStart=/usr/sbin/${svc} (code=exited, status=0/SUCCESS)`,
          `   Main PID: 1124 (${svc})`,
          `      Tasks: 2 (limit: 1152)`,
          `     Memory: 4.2M`,
          `        CPU: 1.230s`,
        ].join('\r\n');
    }
    return `Unknown action: ${action}`;
  }

  _service(args) {
    return this._systemctl([args[1], args[0]]);
  }

  _docker(args) {
    if (!this.installed.has('docker') && !this.installed.has('docker.io')) {
      return `${c('red', 'bash: docker: command not found')}\r\n${A.gray}Hint: apt install docker.io${A.reset}`;
    }
    const [subcmd, ...rest] = args;
    switch (subcmd) {
      case 'ps':       return `CONTAINER ID   IMAGE         COMMAND    CREATED       STATUS       PORTS     NAMES\r\n(no containers running)`;
      case 'images':   return `REPOSITORY    TAG       IMAGE ID       CREATED       SIZE\r\nnginx         latest    abc123def456   3 days ago    142MB`;
      case 'version':  return `Docker version 24.0.6, build ed223bc`;
      case 'pull':     return `${rest[0]}: Pulling from library/${rest[0]}\r\n${c('green', 'Status: Downloaded newer image for')} ${rest[0]}:latest`;
      case 'run':      return c('green', `Starting container '${rest.slice(-1)[0] || 'mycontainer'}'...`);
      case 'stop':     return c('yellow', `Container '${rest[0]}' stopped.`);
      default:         return `docker: '${subcmd}' is not a docker command`;
    }
  }

  _git(args) {
    const [subcmd, ...rest] = args;
    switch (subcmd) {
      case 'status':  return `On branch main\r\nYour branch is up to date with 'origin/main'.\r\n\r\nnothing to commit, working tree clean`;
      case 'log':     return [
        `${c('yellow', 'commit a1b2c3d')} (${c('cyan', 'HEAD -> main')}, ${c('green', 'origin/main')})`,
        `Author: MTS Hackathon <hack@mts.ru>`,
        `Date:   ${new Date().toDateString()}`,
        '',
        `    feat: initial deployment`,
      ].join('\r\n');
      case 'clone':   return `Cloning into '${rest[0]?.split('/').pop() || 'repo'}'...\r\nremote: Counting objects: 156, done.\r\n${c('green', 'Receiving objects: 100% (156/156), done.')}`;
      case 'pull':    return `remote: Counting objects: 3, done.\r\nUpdating a1b2c3d..d4e5f6g\r\n${c('green', 'Fast-forward\r\n 1 file changed, 5 insertions(+)')}`;
      case 'push':    return `Enumerating objects: 5, done.\r\nCounting objects: 100% (5/5), done.\r\nTo github.com:org/repo.git\r\n   a1b2c3d..d4e5f6g  main -> main`;
      case 'init':    return c('green', `Initialized empty Git repository in ${this.cwd}/.git/`);
      case 'add':     return '';
      case 'commit':  return `[main a1b2c3d] ${rest.find(a => !a.startsWith('-')) || 'update'}\r\n 1 file changed`;
      default:        return `git: '${subcmd}' is not a git command`;
    }
  }

  _node(argStr) {
    if (!argStr) return `Welcome to Node.js v20.11.0.\r\nType ".exit" to exit.\r\n> `;
    return c('cyan', `[Running: node ${argStr}]`);
  }

  _npm(args) {
    const [subcmd, ...rest] = args;
    switch (subcmd) {
      case 'install':
      case 'i':   return `\r\nadded ${Math.floor(Math.random()*200+50)} packages in ${(Math.random()*5+1).toFixed(0)}s\r\n${c('green', '✓ up to date, audited 234 packages in 1s')}`;
      case 'start': return c('green', '> Starting app...\r\nServer listening on port 3000');
      case 'run':   return c('cyan', `> Executing: ${rest.join(' ')}`);
      case '-v':    return '10.2.4';
      default:      return `npm: unknown command '${subcmd}'`;
    }
  }

  _python(argStr) {
    if (!argStr) return `Python 3.11.4 (default)\r\nType "exit()" to quit.\r\n>>> `;
    if (argStr.includes('--version') || argStr.includes('-V')) return `Python 3.11.4`;
    return c('cyan', `[Running: python3 ${argStr}]`);
  }

  _runScript(path) {
    const entry = this.fs[path] || this.fs[`${this.cwd}/${path}`];
    if (!entry) return `bash: ${path}: No such file or directory`;
    if (entry.type === 'd') return `bash: ${path}: Is a directory`;
    return c('green', `Executing ${path}...\r\n`) + (entry.content || '');
  }

  _history() {
    return this.history.slice(0, 20).map((cmd, i) => `  ${String(this.history.length - i).padStart(3)}  ${cmd}`).join('\r\n');
  }

  _help() {
    return [
      '',
      `${b('─── MTS Cloud Web Terminal ─────────────────────────────────')}`,
      '',
      `${c('cyan', 'Navigation:')}   ${c('yellow','ls')} ${c('yellow','cd')} ${c('yellow','pwd')} ${c('yellow','find')}`,
      `${c('cyan', 'Files:')}        ${c('yellow','cat')} ${c('yellow','head')} ${c('yellow','tail')} ${c('yellow','mkdir')} ${c('yellow','touch')} ${c('yellow','rm')} ${c('yellow','cp')} ${c('yellow','mv')} ${c('yellow','echo')}`,
      `${c('cyan', 'System:')}       ${c('yellow','top')} ${c('yellow','ps')} ${c('yellow','free')} ${c('yellow','df')} ${c('yellow','uptime')} ${c('yellow','uname')} ${c('yellow','whoami')}`,
      `${c('cyan', 'Network:')}      ${c('yellow','ip')} ${c('yellow','ifconfig')} ${c('yellow','netstat')} ${c('yellow','ping')} ${c('yellow','curl')} ${c('yellow','wget')}`,
      `${c('cyan', 'Packages:')}     ${c('yellow','apt update')} ${c('yellow','apt install <pkg>')} ${c('yellow','dpkg -l')}`,
      `${c('cyan', 'Services:')}     ${c('yellow','systemctl start/stop/status <svc>')}`,
      `${c('cyan', 'Docker:')}       ${c('yellow','docker ps')} ${c('yellow','docker images')} ${c('yellow','docker run')}`,
      `${c('cyan', 'Dev:')}          ${c('yellow','git')} ${c('yellow','node')} ${c('yellow','npm')} ${c('yellow','python3')}`,
      '',
      `${c('gray', 'Keyboard: ↑↓ history • Ctrl+C interrupt • Ctrl+L clear • Tab complete')}`,
      `${b('──────────────────────────────────────────────────────────────')}`,
      '',
    ].join('\r\n');
  }
}

module.exports = MockShell;
