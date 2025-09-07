const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'sites', '0755tt', 'exam.js');
let s = fs.readFileSync(file, 'utf8');

const startAnchor = 'case this.states.WAITING_FOR_ANSWERS';
const endAnchor = 'case this.states.WAITING_FOR_QUESTIONS';

const start = s.indexOf(startAnchor);
if (start === -1) {
  console.error('Start anchor not found');
  process.exit(1);
}
const end = s.indexOf(endAnchor, start);
if (end === -1) {
  console.error('End anchor not found');
  process.exit(1);
}

const replacement =
  "case this.states.WAITING_FOR_ANSWERS: {\n" +
  "            try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('exam', 'wait.answers', 'info'); } catch {}\n" +
  "            await waitFor(() => tt.__answersReady === true, 20000, 500, 'Agent捕获答案');\n" +
  "            this.transitionTo(this.states.WAITING_FOR_QUESTIONS);\n" +
  "            break;\n" +
  "          }\n\n";

const before = s.slice(0, start);
const after = s.slice(end);
const out = before + replacement + after;
fs.writeFileSync(file, out);
console.log('Patched WAITING_FOR_ANSWERS block');

