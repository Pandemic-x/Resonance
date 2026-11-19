/* ================= Helpers ================= */
const G = (t, tup, beam) => ({ t, tup: tup || null, beam: beam || null });
const BAR = () => G(['|']);
const rep = (x, n) => Array(n).fill(x);

const UNITS = {
  16: { notes: {1:'16',2:'8',3:'8d',4:'q',6:'qd'}, rests: [[4,'qr'],[2,'8r'],[1,'16r']] },
  32: { notes: {1:'32',2:'16',3:'16d',4:'8',6:'8d',7:'8dd',8:'q'}, rests: [[8,'qr'],[4,'8r'],[2,'16r'],[1,'32r']] },
  8:  { notes: {1:'8',2:'q',3:'qd'}, rests: [[3,'qdr'],[1,'8r']] },
};
function fromSpans(spans, unit){
  const U = UNITS[unit], out = []; let p = 0;
  for (const s of spans){
    if (s > 0){ out.push(U.notes[s]); p += s; }
    else {
      let L = -s;
      while (L > 0){
        const [d, name] = U.rests.find(([d]) => d <= L && p % d === 0) || U.rests[U.rests.length-1];
        out.push(name); p += d; L -= d;
      }
    }
  }
  return out;
}
function maskToSpans(bits){
  const n = bits.length, att = [];
  bits.forEach((b,i)=>{ if(b) att.push(i); });
  if (!att.length) return [-n];
  const spans = [];
  if (att[0] > 0) spans.push(-att[0]);
  att.forEach((a,i)=> spans.push((i+1 < att.length ? att[i+1] : n) - a));
  return spans;
}
function shortSpans(bits){
  const sp = [];
  bits.forEach(b => { if (b) sp.push(1); else if (sp.length && sp[sp.length-1] < 0) sp[sp.length-1]--; else sp.push(-1); });
  return sp;
}
function allMasks(n){ const r=[]; for(let m=(1<<n)-1;m>=0;m--) r.push([...Array(n)].map((_,i)=> (m>>(n-1-i))&1)); return r; }
function sylTitle(bits, labels){ return bits.some(Boolean) ? labels.map((l,i)=> bits[i]? l : '–').join(' ') : 'rust'; }
const spanTitle = sp => sp.map(s => s<0 ? 'r' : s).join('-');

