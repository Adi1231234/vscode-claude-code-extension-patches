/* A box placed in the panel's zoom: lib/js/ccPlace.js against a stand-in DOM
 * whose numbers are the ones measured in a real panel at zoom 1.2 (rects and
 * innerWidth in viewport pixels, a style length in the body's).
 *
 *     node lib/tests/place.test.js
 *
 * Pinned: the scale is measured off the body, not read from its zoom; a box
 * lands gap below its anchor (in the body's pixels, so gap x zoom on screen),
 * turns above when it does not fit, sits above when asked, centres when asked,
 * and stays margin inside the viewport; at zoom 1 nothing changes. */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };
const near = (a, b) => Math.abs(a - b) < 0.01;

function panel(zoom) {
  const ctx = { innerWidth: 838, innerHeight: 948 };
  ctx.window = ctx;
  ctx.document = { body: { offsetWidth: 838 / zoom, getBoundingClientRect: () => ({ width: 838 }) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'ccPlace.js'), 'utf8'), ctx);
  return ctx.__ccPlace;
}
const rect = (left, top, width, height) => ({ getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }) });
function box(width, height) {
  const b = rect(0, 0, width, height);
  b.style = {};
  b.at = () => ({ left: parseFloat(b.style.left), top: parseFloat(b.style.top) });
  return b;
}

const P = panel(1.2);
ok(near(P.scale(), 1.2), 'the scale is the body\'s rect over its own width');
ok(near(P.css(120), 100), 'a viewport length becomes a body length');

let b = box(240, 110);
P.near(b, rect(59, 614, 19, 26), { gap: 4 });
ok(near(b.at().top * 1.2, 640 + 4.8) && near(b.at().left * 1.2, 59), 'under the anchor, 4px of the body below it - the row menu');

b = box(240, 110);
P.near(b, rect(59, 860, 19, 26), { gap: 4 });
ok(near(b.at().top * 1.2 + 110, 860 - 4.8), 'turned above when it would leave the viewport');

b = box(240, 110);
P.near(b, rect(800, 10, 30, 30), { gap: 2 });
ok(near(b.at().left * 1.2, 838 - 7.2 - 240), 'pulled in to stay its margin inside the right edge');

b = box(60, 20);
P.near(b, rect(400, 500, 100, 18), { above: true, center: true, gap: 6, margin: 4 });
ok(near(b.at().top * 1.2 + 20, 500 - 7.2) && near(b.at().left * 1.2 + 30, 450), 'above and centred - the copy toast');

b = box(60, 20);
P.near(b, rect(400, 2, 100, 18), { above: true, gap: 6, margin: 4 });
ok(near(b.at().top * 1.2, 20 + 7.2), 'above turns below when there is no room');

const one = panel(1);
b = box(240, 110);
one.near(b, rect(59, 614, 19, 26), { gap: 4 });
ok(near(b.at().top, 644) && near(b.at().left, 59), 'at zoom 1 the numbers go in as they were read');

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
