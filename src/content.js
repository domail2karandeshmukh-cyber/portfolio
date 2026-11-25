/* CyberAtlas content: four modules, thirteen lessons with their quizzes, four labs and the certification roadmap.

   Original text, written for this project. Lessons are data, so the app, the tests and a later translation read the
   same thing. A block is ["p", text], ["h", heading], ["code", text] or ["list", [items]]; text is plain, with
   `backquotes` for code. A quiz question has one right option (answer is its number, from 0) and says why. */
(function (root) {
  "use strict";

  var MODULES = [
    { id: "linux", title: "Linux and the command line", blurb: "Find your way around a Linux system and read what it writes down.", lessons: ["files", "permissions", "logs"], lab: "ssh-log" },
    { id: "network", title: "Networking", blurb: "How computers find and talk to each other, and how a firewall decides what may pass.", lessons: ["addresses", "tcp", "dns", "firewalls"], lab: "firewall" },
    { id: "accounts", title: "Accounts and phishing", blurb: "How a system knows it is you, how attackers get past that, and how to read a message that wants your password.", lessons: ["passwords", "mfa", "phishing"], lab: "phishing" },
    { id: "soc", title: "Security operations", blurb: "What an analyst does when an alert arrives: read it, check it, decide.", lessons: ["soc", "alerts", "triage"], lab: "triage" },
  ];

  var LESSONS = {
    files: { title: "Files and paths", minutes: 6, body: [
      ["p", "Almost everything on a Linux system is a file in one tree. The tree starts at `/`, called the root. Folders (directories) hang from it, and every file has an address in the tree: its path."],
      ["p", "A path that starts with `/` is absolute: it says where a file is from the root, so it means the same thing wherever you are. `/var/log/auth.log` is the file `auth.log`, in the folder `log`, in the folder `var`. A path that doesn’t start with `/` is relative: it starts from the folder you are in."],
      ["h", "Four commands to move around"],
      ["list", ["`pwd` prints the folder you are in.", "`ls` lists what is in a folder. `ls -l` adds the owner, the size and the permissions.", "`cd` changes folder. `cd ..` goes up one level, and `cd` alone goes home.", "`cat` prints a file."]],
      ["h", "Where things usually are"],
      ["list", ["`/home` holds each user’s own folder.", "`/etc` holds settings, as text files.", "`/var/log` holds logs: the system’s diary. An analyst spends a lot of time here."]],
      ["p", "Two short names are worth knowing: `.` is the folder you are in, and `..` is the one above it."],
    ], quiz: [
      { q: "Which of these is an absolute path?", options: ["log/auth.log", "../etc/hostname", "/var/log/auth.log", "auth.log"], answer: 2, why: "It starts with /, so it is read from the root and means the same from any folder." },
      { q: "You are in /home/analyst and run cd .. Where are you now?", options: ["/", "/home", "/home/analyst/..", "/analyst"], answer: 1, why: ".. is the folder above the one you are in, and the folder above /home/analyst is /home." },
      { q: "Where would you look first for a record of who logged in?", options: ["/home", "/etc", "/var/log", "/tmp"], answer: 2, why: "/var/log holds the logs. /etc holds settings, and /home holds users’ own files." },
    ] },
    permissions: { title: "Users and permissions", minutes: 7, body: [
      ["p", "Linux decides who may do what with each file from three things: the file’s owner, the file’s group, and everybody else. For each of the three it stores three permissions: read (`r`), write (`w`) and execute (`x`)."],
      ["p", "`ls -l` shows them as ten characters:"],
      ["code", "-rw-r-----  root adm  2210  auth.log"],
      ["p", "The first character is the type: `-` for a file, `d` for a directory. Then come three groups of three. Here the owner (`root`) has `rw-`: read and write. The group (`adm`) has `r--`: read only. Everybody else has `---`: nothing. So a user in the group `adm` can read this log, and a user outside it can’t."],
      ["h", "Why it matters for security"],
      ["list", ["Least privilege: an account should have the permissions its job needs and no more. Then a stolen account can do less.", "`root` is the account that the permissions don’t stop. Work as an ordinary user and borrow root’s rights for one command with `sudo`.", "A file that anyone can write, or a new member of the `sudo` group, is a change worth an alert."]],
      ["p", "`whoami` prints your user name. `id` prints your user, your group and the other groups you belong to."],
    ], quiz: [
      { q: "A file shows -rw-r----- with owner root and group adm. Who can read it?", options: ["Only root", "root and the members of adm", "Everybody", "Nobody"], answer: 1, why: "The owner has rw-, the group has r--, and everybody else has ---. So root and the members of adm can read it." },
      { q: "What does least privilege mean?", options: ["Every user is an administrator, to save time", "An account gets only the permissions its job needs", "Passwords are as short as allowed", "Logs are deleted every day"], answer: 1, why: "With only the permissions it needs, an account that is misused or stolen can do less damage." },
      { q: "Why is an unexpected new member of the sudo group worth an alert?", options: ["sudo makes the computer slower", "The group may run commands as root", "The group can’t read logs", "It changes the host name"], answer: 1, why: "Members of sudo can run commands with root’s rights, so an unplanned member is a new administrator nobody approved." },
    ] },
    logs: { title: "Reading logs", minutes: 8, body: [
      ["p", "A log is a text file that a program adds a line to when something happens. One line is one event, and it usually says when, on which machine, which program, and what."],
      ["code", "Nov 12 09:02:17 lab-web01 sshd[2105]: Failed password for maria from 192.0.2.31 port 50890 ssh2"],
      ["p", "Read it left to right: the time, the host (`lab-web01`), the program (`sshd`, the SSH server), then the message. The message says a password was wrong for the user `maria`, and where the attempt came from."],
      ["h", "Find the lines you need"],
      ["p", "Logs are long. `grep` prints only the lines that contain a text, and the pipe `|` passes one command’s output to the next:"],
      ["code", "grep \"Failed password\" /var/log/auth.log\ngrep -c \"Failed password\" /var/log/auth.log\ngrep Failed /var/log/auth.log | grep 203.0.113.45"],
      ["p", "The first prints every failed attempt. The second counts them (`-c`). The third keeps the failures, then keeps those from one address."],
      ["h", "What to look for"],
      ["list", ["One wrong password, then a right one, from the usual address: a person who mistyped.", "Many failures from one address against several accounts: someone guessing passwords.", "Many failures and then a success from that address: the guess worked. That one can’t wait."]],
    ], quiz: [
      { q: "In the line “Nov 12 09:02:17 lab-web01 sshd[2105]: Failed password for maria …”, what is sshd?", options: ["The user who logged in", "The program that wrote the line", "The address of the attacker", "The name of the log file"], answer: 1, why: "After the time and the host comes the program that reported the event: sshd, the SSH server." },
      { q: "What does grep -c \"Failed password\" auth.log print?", options: ["The first failed attempt", "Every line except the failures", "The number of lines that contain “Failed password”", "The file’s size"], answer: 2, why: "-c makes grep count the matching lines instead of printing them." },
      { q: "Which pattern needs attention first?", options: ["One failure then a success from the user’s usual address", "A backup job that logs in at 02:00 every night", "Nine failures and then a success from an outside address", "No logins at all on a Sunday"], answer: 2, why: "A run of failures that ends in a success from an outside address means a guessed password may have worked." },
    ] },
    addresses: { title: "IP addresses and subnets", minutes: 8, body: [
      ["p", "Every device on a network has an IP address so that others can send to it. An IPv4 address is four numbers from 0 to 255, such as `192.0.2.80`."],
      ["p", "Addresses are grouped into networks. `192.0.2.0/24` names a network: the `/24` says that the first 24 bits (the first three numbers) are the same for every member, so it runs from `192.0.2.0` to `192.0.2.255`. A smaller number after the slash means a bigger network: a `/16` has 65,536 addresses, a `/24` has 256, and a `/27` has 32."],
      ["h", "Private and public"],
      ["p", "Some ranges are set aside for use inside organizations and homes, and aren’t routed on the internet: `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16`. A router translates between those private addresses and a public one (NAT). So an address that starts with `10.` or `192.168.` in a log is from inside some network, usually your own."],
      ["h", "Addresses in this course"],
      ["p", "The labs use `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`. These three ranges are reserved for documentation and examples, so nothing here can point at a real machine by accident."],
    ], quiz: [
      { q: "How many addresses does 192.0.2.0/24 hold?", options: ["24", "256", "65,536", "1"], answer: 1, why: "/24 fixes the first 24 of the 32 bits. The 8 bits left give 256 addresses." },
      { q: "Which of these is a private address?", options: ["203.0.113.45", "8.8.8.8", "192.168.1.20", "198.51.100.7"], answer: 2, why: "192.168.0.0/16 is one of the three private ranges. 203.0.113.x and 198.51.100.x are reserved for documentation." },
      { q: "Which network is larger?", options: ["A /27", "A /24", "A /16", "They are the same size"], answer: 2, why: "The number after the slash is how many bits are fixed. Fewer fixed bits leave more addresses, so a /16 is the largest." },
    ] },
    tcp: { title: "TCP, ports and the handshake", minutes: 7, body: [
      ["p", "An IP address gets a packet to a machine. A port gets it to one program on that machine. Ports are numbers from 0 to 65,535, and common services have usual ones: 22 for SSH, 53 for DNS, 80 for HTTP, 443 for HTTPS, 5432 for PostgreSQL."],
      ["p", "Most of those services use TCP, which sets up a connection before any data moves. The setup takes three packets, the three-way handshake:"],
      ["list", ["The client sends SYN: “I’d like to talk.”", "The server answers SYN-ACK: “I hear you, and I’d like to talk too.”", "The client sends ACK: “Agreed.” The connection is open."]],
      ["h", "What a scan looks like"],
      ["p", "If nothing listens on a port, the server answers a SYN with RST: “no.” If a firewall drops the packet, there is no answer at all. A port scan sends SYNs to many ports and notes which ones answer SYN-ACK, to learn what a machine offers. One SYN to port 443 is a visitor. A thousand ports in a minute from one address is a scan."],
      ["p", "A scan isn’t always an attack: administrators and vulnerability scanners scan their own networks to find what is exposed before someone else does. The question for an analyst is who is scanning, and whether they are meant to."],
    ], quiz: [
      { q: "What is the order of the three-way handshake?", options: ["ACK, SYN, SYN-ACK", "SYN, SYN-ACK, ACK", "SYN, ACK, FIN", "SYN-ACK, SYN, ACK"], answer: 1, why: "The client asks (SYN), the server agrees and asks back (SYN-ACK), and the client confirms (ACK)." },
      { q: "Which port does HTTPS usually use?", options: ["22", "53", "443", "5432"], answer: 2, why: "443 is the usual port for HTTPS. 22 is SSH, 53 is DNS and 5432 is PostgreSQL." },
      { q: "One address sends SYN packets to 1,024 ports of a server in 40 seconds. What is it?", options: ["A normal visit to a website", "A port scan", "A DNS lookup", "A backup"], answer: 1, why: "Trying many ports quickly to see which answer is a port scan. Whether it’s hostile depends on who is doing it." },
    ] },
    dns: { title: "DNS: names to addresses", minutes: 6, body: [
      ["p", "People use names and computers use addresses. The Domain Name System (DNS) translates one into the other: you ask for `www.example.com`, and DNS answers with an address."],
      ["p", "Your computer doesn’t know the answer itself. It asks a resolver, usually run by your organization or your internet provider. If the resolver hasn’t seen the name recently, it asks the servers that are responsible for it, then remembers the answer for a while (the record’s time to live, TTL)."],
      ["h", "Records you will meet"],
      ["list", ["`A`: a name to an IPv4 address.", "`AAAA`: a name to an IPv6 address.", "`CNAME`: a name that is another name’s alias.", "`MX`: where mail for a domain goes.", "`TXT`: free text, used for proving who owns a domain and for mail security."]],
      ["h", "Why analysts read DNS logs"],
      ["p", "Almost everything a computer does on the internet starts with a DNS question, malware included. A machine that asks for a name on a block list, or for hundreds of random-looking names, is telling you something. So is a lookalike name such as `examp1e.com`, with a digit 1 in place of the letter l: a common trick in phishing."],
    ], quiz: [
      { q: "What does DNS do?", options: ["Encrypts web pages", "Translates names into addresses", "Blocks port scans", "Stores passwords"], answer: 1, why: "DNS answers the question “which address belongs to this name?”" },
      { q: "Which record maps a name to an IPv4 address?", options: ["MX", "TXT", "A", "CNAME"], answer: 2, why: "An A record holds a name’s IPv4 address. MX is for mail, and CNAME is an alias." },
      { q: "A workstation asks for hundreds of random-looking names in a minute. Why is that worth a look?", options: ["DNS is always an attack", "It can be malware looking for its control server", "Random names are faster", "It means the resolver is full"], answer: 1, why: "Some malware works through lists of generated names to find a server it can reach, which shows up as a burst of odd lookups." },
    ] },
    firewalls: { title: "Firewalls and rules", minutes: 8, body: [
      ["p", "A firewall sits between networks and decides which traffic may pass. It decides by rules, and a simple rule has four parts: an action (allow or deny), a source, a destination and a port."],
      ["code", "allow  internet  ->  web server  port 443\nallow  admin     ->  web server  port 22"],
      ["h", "Two ideas that decide everything"],
      ["list", ["First match wins. The firewall reads the rules from the top and stops at the first one that fits the packet. So the order of the rules matters.", "Default deny. A packet that fits no rule is dropped. You list what is allowed, and everything else is refused without your having to think of it."]],
      ["p", "With default deny, a short list is the safe list. Every allow rule is a door, so write it as narrowly as the need: the one source, the one destination, the one port. A rule such as “allow any to web server, any port” also opens SSH to the whole internet, whether you meant it or not."],
      ["h", "Zones"],
      ["p", "Networks are split into zones by how much they are trusted. A server that the internet must reach, such as a web server, goes in its own zone. A database goes behind it, reachable from the web server only. Then someone who breaks into the web server still has a firewall between them and the data."],
    ], quiz: [
      { q: "A firewall has the rules “allow any -> web, any port” and then “deny internet -> web, port 22”. Can the internet reach SSH on the web server?", options: ["No, the deny rule stops it", "Yes, the first rule matches first", "Only on Thursdays", "It depends on DNS"], answer: 1, why: "First match wins. The packet fits the first rule, so the firewall allows it and never reads the second." },
      { q: "What does default deny mean?", options: ["Every packet is refused, always", "A packet that fits no rule is dropped", "The first rule must be a deny", "Only administrators may browse"], answer: 1, why: "You list what is allowed. Anything that matches no rule is refused." },
      { q: "Why put the database in a zone that only the web server can reach?", options: ["Databases are slow", "A break-in on the web server doesn’t give the internet a path to the data", "It makes DNS faster", "Zones replace passwords"], answer: 1, why: "Each zone boundary is another firewall decision an attacker has to get past." },
    ] },
    passwords: { title: "How passwords are stored and guessed", minutes: 8, body: [
      ["p", "A well-built system doesn’t keep your password. It keeps a hash of it: the result of a one-way calculation that is easy to do and impractical to undo. When you log in, the system hashes what you typed and compares the two results."],
      ["p", "So when a database of accounts is stolen, the thief has hashes, not passwords, and has to guess: hash a candidate, compare, try the next. How well the passwords survive depends on two choices the system’s builders made."],
      ["h", "Salt, and a slow hash"],
      ["list", ["A salt is a random value, different for each account, that is mixed in before hashing and stored beside the hash. Two people with the same password then have different hashes, and a table of hashes worked out in advance is useless.", "A password hash should be slow on purpose. `bcrypt`, `scrypt` and `Argon2` were made for passwords and can be tuned to take a noticeable fraction of a second. General-purpose hashes such as `MD5` and `SHA-1` are built to be fast, which lets an attacker try a very large number of guesses a second: they are the wrong tool for passwords."]],
      ["h", "Four ways of guessing"],
      ["list", ["Online guessing: trying passwords at the login page. It is slow, and lockouts and delays slow it more. This is what the SSH log in the first lab shows.", "Password spraying: one common password tried against many accounts, to stay under each account’s lockout.", "Credential stuffing: pairs of user name and password leaked from one site, tried on another. It works when people reuse passwords.", "Offline cracking: guessing against stolen hashes on the attacker’s own machines, where no lockout applies."]],
      ["h", "What follows for you"],
      ["p", "Length does more than odd characters: a long phrase is harder to guess than a short tangle of symbols. A password used on one site only can’t be stuffed into another. A password manager makes both practical. And because any password can leak, a second factor matters: the next lesson."],
      ["p", "Current guidance, such as that of the US standards institute NIST, also advises against making people change passwords on a calendar when there is no sign of a leak: it tends to produce weaker passwords, not stronger ones."],
    ], quiz: [
      { q: "Why does a system store a hash instead of the password?", options: ["A hash is shorter", "So that a stolen database doesn’t hand over the passwords themselves", "So that the administrators can read passwords when needed", "Hashes make logging in faster"], answer: 1, why: "A hash can be checked against what you type but can’t practically be turned back into the password, so a thief still has to guess." },
      { q: "What does a salt do?", options: ["It encrypts the database", "It makes the password longer for the user to type", "It makes the same password give a different hash for each account", "It locks the account after failed logins"], answer: 2, why: "A per-account random value means equal passwords don’t have equal hashes, and tables of hashes prepared in advance don’t apply." },
      { q: "A log shows one password tried once against each of 400 accounts. What is this?", options: ["Offline cracking", "Password spraying", "A salt collision", "Normal mistyping"], answer: 1, why: "Spraying tries one likely password across many accounts, so that no single account reaches its lockout." },
    ] },
    mfa: { title: "A second factor", minutes: 7, body: [
      ["p", "A password is something you know. Multi-factor authentication (MFA) asks for a second proof of a different kind, so that a stolen password is not enough."],
      ["list", ["Something you know: a password, a PIN.", "Something you have: a phone, a security key.", "Something you are: a fingerprint, a face."]],
      ["p", "Two proofs of the same kind, such as a password and a memorable word, are two steps but one factor."],
      ["h", "Not all second factors are equal"],
      ["list", ["A code by text message is better than nothing, but a phone number can be moved to an attacker’s SIM card, and a code can be read out to a caller.", "A code from an authenticator app changes every 30 seconds and doesn’t depend on the phone network. A fake login page can still ask for it and use it at once.", "A push notification (“Is this you?”) is convenient. Its weakness is fatigue: an attacker who has the password sends request after request until the person taps Approve to make it stop. Having to type a number shown on the login screen helps.", "A security key or a passkey checks the address of the site before it answers. A fake site at another address gets nothing, which is why this kind resists phishing."]],
      ["h", "What a defender watches for"],
      ["list", ["Many refused or ignored MFA requests for one account, then an approval.", "A new phone or key registered soon after a password reset.", "A login that passed MFA from a country or device the person has never used."]],
      ["p", "MFA narrows the attack; it doesn’t end it. Attackers who can’t get past it go around it, usually by tricking the person. That is the next lesson."],
    ], quiz: [
      { q: "Which pair is two different factors?", options: ["A password and a PIN", "A password and a code from an app on your phone", "A fingerprint and a face scan", "Two security questions"], answer: 1, why: "The password is something you know and the phone is something you have. The other pairs are two of the same kind." },
      { q: "An account shows 14 refused push requests in ten minutes, then one approved. What is the likeliest story?", options: ["The person forgot their phone", "The MFA service was slow", "Someone has the password and wore the person down", "A new employee is being set up"], answer: 2, why: "Repeated requests until one is approved is the pattern of MFA fatigue, and it means the password is already known to someone else." },
      { q: "Why does a security key resist a fake login page?", options: ["Its codes are longer", "It checks the site’s address and won’t answer a different one", "It needs a fingerprint", "It works without the internet"], answer: 1, why: "The key’s answer is tied to the real site’s address, so a look-alike page at another address can’t collect anything usable." },
    ] },
    phishing: { title: "Reading a message that wants something", minutes: 8, body: [
      ["p", "Phishing is a message that pretends to come from someone you trust, to get you to do one of three things: type a password into a fake page, open a file that runs a program, or send money. It works on people, not on software, which is why it gets past good technical defences."],
      ["h", "Who really sent it"],
      ["p", "A message shows a display name and an address. Anyone can set the display name to “IT Service Desk” or to your manager’s name. Read the address, and in the address read the part after the `@`."],
      ["h", "Where a link really goes"],
      ["p", "A link has a text you see and an address it goes to, and the two can differ. Look at the address before you follow it. Then read its host name from the right: the name just before the ending is the one somebody registered, and everything to its left is theirs to invent."],
      ["code", "portal.larkfield.example                          belongs to larkfield.example\nportal.larkfield.example.account-verify.example   belongs to account-verify.example"],
      ["p", "Some endings have two parts, such as `.co.uk`; the registered name is then the one before both."],
      ["h", "What it asks, and how"],
      ["list", ["A password, a code or card details, asked for by message.", "A hurry: “within 2 hours”, “today”.", "Secrecy: “keep this between us”, “I can’t take calls”.", "Payment in a way that can’t be undone: gift cards, a new bank account for a known supplier.", "An attachment that asks you to switch something on, such as macros (“Enable content”)."]],
      ["p", "No single sign is proof. Real messages have deadlines, and a real colleague’s account can be taken over and used to send from the real address. Ask whether you expected the message, and whether the request fits the person."],
      ["h", "What to do"],
      ["list", ["When in doubt, check through a channel you already have: a number you know, the site you type yourself. Never through the message.", "Report it; don’t only delete it. The same message went to your colleagues, and a report lets the security team warn them and block the sender.", "If you already clicked or typed something, say so at once. Speed matters more than blame."]],
    ], quiz: [
      { q: "Who owns the host name `login.bank.example.secure-check.example`?", options: ["bank.example", "login.bank.example", "secure-check.example", "The owner of `.example`"], answer: 2, why: "Read from the right: the registered name is the one just before the ending. Everything to its left was made up by its owner." },
      { q: "A message from your manager’s real address, sent at 3 in the morning, asks you to open an invoice and “Enable content”. What do you make of it?", options: ["Safe: the address is real", "Suspicious: an account can be taken over, and the request doesn’t fit", "Safe if the file name looks right", "Only suspicious if there is also a link"], answer: 1, why: "A genuine address shows which account sent it, not who was at the keyboard. An unexpected file that wants macros switched on is a classic way to run a program." },
      { q: "You get an obvious phishing message. What is the most useful thing to do?", options: ["Delete it quietly", "Reply and tell the sender off", "Forward it to all your colleagues as a warning", "Report it to the security team"], answer: 3, why: "A report lets the team block the sender and warn others. Forwarding it spreads the dangerous link, and replying confirms your address is read." },
    ] },
    soc: { title: "What a SOC does", minutes: 6, body: [
      ["p", "A security operations center (SOC) is the team that watches an organization’s systems for attacks and responds to them. Its raw material is logs: from servers, firewalls, workstations and cloud services."],
      ["p", "Nobody can read all of that, so a SIEM (security information and event management system) collects the logs, and rules pick out the events that look like trouble. Wazuh is one open-source system of this kind. When a rule fires, it makes an alert."],
      ["h", "The analyst’s loop"],
      ["list", ["Triage: is this alert real, and how bad is it?", "Investigate: what happened before and after, on which machines, to which accounts?", "Respond: contain it (lock the account, isolate the machine), then fix what let it happen.", "Improve: adjust the rule, the system or the procedure so it is caught earlier, or doesn’t happen."]],
      ["h", "Two words to keep straight"],
      ["p", "A true positive is an alert about something real. A false positive is an alert about something harmless. Most alerts in most SOCs are false positives, and each one costs an analyst time. A good analyst closes them quickly and correctly, with the reason written down, and keeps attention for the real ones."],
    ], quiz: [
      { q: "What does a SIEM do?", options: ["Replaces the firewall", "Collects logs and raises alerts from rules", "Resets passwords", "Encrypts disks"], answer: 1, why: "A SIEM gathers logs from many systems and applies rules that turn suspicious events into alerts." },
      { q: "What is a false positive?", options: ["An attack that no rule noticed", "An alert about something harmless", "A broken log file", "A weak password"], answer: 1, why: "The rule fired, but what happened was harmless. An attack that nothing noticed is a false negative." },
      { q: "Which comes first when an alert arrives?", options: ["Respond", "Improve the rule", "Triage", "Write the yearly report"], answer: 2, why: "Triage decides whether the alert is real and how urgent it is. Everything else depends on that." },
    ] },
    alerts: { title: "Anatomy of an alert", minutes: 7, body: [
      ["p", "An alert is a rule’s summary of one or more log lines. Systems differ in the names of the fields, and most carry the same information:"],
      ["list", ["When it happened.", "Which rule fired, with its description and its level: how serious the rule’s author thinks it is.", "Which agent reported it: the machine the log came from.", "The fields the rule read: a source address, a user name, a file, a command.", "The log lines themselves, as evidence."]],
      ["h", "The level is a starting point"],
      ["p", "A high level means “look at this soon”. It doesn’t mean “this is an attack”. A rule can’t know that the address is your own scanner or that the account is a backup job. That knowledge is context, and finding it is the analyst’s work."],
      ["h", "Context to look up"],
      ["list", ["Whose address is it? An asset inventory says which addresses are yours and what they do.", "Was a change planned? Change tickets and calendars explain a lot of odd events.", "What else happened? Other alerts for the same address, user or machine, a little earlier or later.", "Is it normal here? A backup at 02:00 every night is a pattern. The same login at 14:00 isn’t."]],
      ["p", "In this course the alerts are invented and only shaped like a SIEM’s. The rule numbers aren’t real ones."],
    ], quiz: [
      { q: "What does an alert’s level tell you?", options: ["That an attack is certain", "How serious the rule’s author thinks such an event is", "How many analysts are needed", "The attacker’s country"], answer: 1, why: "The level is the rule’s estimate. It sets the order of work, and context decides what the event really is." },
      { q: "An alert names the source address 192.0.2.50. What should you look up first?", options: ["The weather", "Whose address it is, in the asset inventory", "The alert’s font", "Nothing: block it at once"], answer: 1, why: "Knowing whether the address is your own scanner, a colleague’s computer or a stranger changes what the alert means." },
      { q: "What is the agent in an alert?", options: ["The analyst on shift", "The machine that reported the log", "The attacker", "The rule’s author"], answer: 1, why: "The agent is the system the event was recorded on, which tells you where to look next." },
    ] },
    triage: { title: "Triage: decide and write it down", minutes: 8, body: [
      ["p", "Triage ends in a decision. For each alert you answer two questions: is it real, and what happens next?"],
      ["h", "A method that works"],
      ["list", ["Read the evidence, not only the title. The log lines say what happened.", "Look up the context: whose address, which account, any planned change, anything nearby in time.", "Ask what a harmless explanation would need to be true, and check it. “It’s probably the scanner” becomes “the inventory lists this address as the scanner, and this is its window.”", "Decide: escalate as an incident, or close.", "Write down why, so that the next analyst can check your reasoning and doesn’t have to repeat it."]],
      ["h", "Signs that an alert is real"],
      ["list", ["Failures followed by a success from the same source.", "A new account, or new rights, that no ticket explains.", "A program doing what it never does: a web server that starts a shell.", "Several alerts that tell one story about the same address or account."]],
      ["h", "Signs of a false alarm"],
      ["list", ["Your own scanner, on its schedule, against its targets.", "A job that broke after a planned change.", "A test that someone announced."]],
      ["p", "When you can’t tell, escalate. Closing a real attack costs far more than asking a colleague to look. And when you close a false alarm, say what would have made it real: that sentence is what improves the rule."],
    ], quiz: [
      { q: "You think an alert is the vulnerability scanner. What makes that a reason to close it?", options: ["It usually is", "The inventory lists the address as the scanner, and this is its scheduled window", "The alert’s level is low", "Nobody complained"], answer: 1, why: "A harmless explanation has to be checked. The inventory and the schedule are facts another analyst can verify." },
      { q: "Which of these is the strongest sign of a real attack?", options: ["A failed login", "A port scan from your own scanner", "A web server process that starts a shell", "An antivirus test during a workshop"], answer: 2, why: "A web server has no reason to start a shell. It means someone is running commands through the web application." },
      { q: "You can’t tell whether an alert is real. What do you do?", options: ["Close it to keep the queue short", "Escalate it", "Delete the log", "Wait a week"], answer: 1, why: "A second look costs minutes. A real attack that was closed costs far more." },
    ] },
  };

  var LABS = {
    "ssh-log": { title: "Read an SSH log", module: "linux", minutes: 15, intro: "Someone tried passwords on the web server. Use the simulated shell to find out how many times, from where, and whether it worked. The shell is a simulator: it has a short list of commands, and its files are invented." },
    firewall: { title: "Write the firewall rules", module: "network", minutes: 15, intro: "Four zones, one firewall. Write rules that meet the policy. The firewall reads your rules from the top, stops at the first that fits, and drops whatever fits none. Then run the test packets: each is worked out on this page, and nothing is sent anywhere." },
    phishing: { title: "Sort the inbox", module: "accounts", minutes: 15, intro: "Six messages in one invented inbox. For each, read who sent it, where its links go and what it asks, decide whether it is phishing or genuine, and choose what to do. Five right out of six passes. Every name ends in .example, which nobody can register, and no link here can be followed." },
    triage: { title: "Triage six alerts", module: "soc", minutes: 20, intro: "Six alerts from one invented day. For each, read the evidence and the context, decide whether it is a real attack or a false alarm, and choose what to do. Five right out of six passes." },
  };

  /* Certifications a learner often aims for. The course is not affiliated with any of these bodies, promises no exam
     result, and uses no exam questions. "helps" names the modules that touch the same ground at a beginner's level. */
  var ROADMAP = [
    { name: "ISC2 Certified in Cybersecurity (CC)", level: "Entry", body: "ISC2", helps: ["network", "accounts", "soc"], note: "Security principles, network security, access control, operations and incident response, without hands-on labs." },
    { name: "CompTIA Security+", level: "Entry to intermediate", body: "CompTIA", helps: ["linux", "network", "accounts", "soc"], note: "A broad exam across threats, architecture, operations and governance. Expect to add much more than this course holds." },
    { name: "Cisco’s associate-level cybersecurity certification", level: "Intermediate", body: "Cisco", helps: ["network", "soc"], note: "Security monitoring, host and network analysis, and SOC procedures. Cisco has renamed this track before, so take its current name and exam from Cisco." },
    { name: "Microsoft SC-200: Security Operations Analyst", level: "Intermediate", body: "Microsoft", helps: ["soc"], note: "Triage and investigation with Microsoft’s own tools, which this course doesn’t teach." },
    { name: "eJPT (Junior Penetration Tester)", level: "Entry, practical", body: "INE Security", helps: ["linux", "network"], note: "A practical exam in authorized penetration testing. This course teaches the defender’s side and no exploitation." },
    { name: "CKA and CKS (Kubernetes)", level: "Later", body: "The Linux Foundation and CNCF", helps: ["linux"], note: "Kubernetes administration and security. Come back to these after containers and cloud basics, which aren’t in this course yet." },
  ];

  var api = { MODULES: MODULES, LESSONS: LESSONS, LABS: LABS, ROADMAP: ROADMAP };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CAContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
