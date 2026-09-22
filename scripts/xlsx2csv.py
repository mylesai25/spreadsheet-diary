import zipfile, csv, re, sys, os, datetime
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
src, outdir = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)

# shared strings
sst = []
if 'xl/sharedStrings.xml' in z.namelist():
    for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
        sst.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))

# styles -> which xf indexes are date/time formats
styles = ET.fromstring(z.read('xl/styles.xml'))
custom = {int(nf.get('numFmtId')): nf.get('formatCode') for nf in styles.iter('{%s}numFmt' % NS['m'])}
def is_date_fmt(fid):
    if 14 <= fid <= 22 or 45 <= fid <= 47: return True
    code = custom.get(fid, '')
    code = re.sub(r'"[^"]*"|\[[^\]]*\]', '', code)
    return bool(re.search(r'[ymdhs]', code, re.I)) and 'General' not in code
def is_time_only(fid):
    code = custom.get(fid, '')
    if 18 <= fid <= 21 or 45 <= fid <= 47: return True
    code = re.sub(r'"[^"]*"|\[[^\]]*\]', '', code)
    return bool(re.search(r'[hs]', code, re.I)) and not re.search(r'[ymd]', code, re.I)
xfs = [int(xf.get('numFmtId', 0)) for xf in styles.find('m:cellXfs', NS)]

def col_idx(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1

def conv(v, t, s):
    if t == 's': return sst[int(v)]
    if t == 'b': return 'TRUE' if v == '1' else 'FALSE'
    if t in ('str', 'inlineStr', 'e'): return v
    if v is None: return ''
    fid = xfs[int(s)] if s is not None else 0
    if is_date_fmt(fid):
        f = float(v)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=f)
        dt = dt.replace(microsecond=0) if abs(dt.microsecond) < 500000 else (dt + datetime.timedelta(seconds=1)).replace(microsecond=0)
        if is_time_only(fid): return dt.strftime('%H:%M:%S') if dt.second else dt.strftime('%H:%M')
        if dt.time() == datetime.time(0): return dt.strftime('%Y-%m-%d')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    if re.fullmatch(r'-?\d+(\.0+)?', v): return str(int(float(v)))
    return v

wb = ET.fromstring(z.read('xl/workbook.xml'))
rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
os.makedirs(outdir, exist_ok=True)
for sh in wb.find('m:sheets', NS):
    name = sh.get('name'); target = rels[sh.get('{%s}id' % NS['r'])]
    path = target if target.startswith('xl/') else 'xl/' + target.lstrip('/')
    root = ET.fromstring(z.read(path))
    rows = []
    for row in root.iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            t = c.get('t'); ref = c.get('r'); s = c.get('s')
            if t == 'inlineStr':
                v = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
            else:
                ve = c.find('m:v', NS); v = ve.text if ve is not None else None
            if v is None: continue
            cells[col_idx(ref)] = conv(v, t, s)
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(i, '') for i in range(width)])
    # trim trailing empty columns/rows
    while rows and not any(rows[-1]): rows.pop()
    width = max((len(r) for r in rows), default=0)
    while width and all(len(r) < width or r[width-1] == '' for r in rows): width -= 1
    rows = [r[:width] + [''] * (width - len(r)) for r in rows]
    fn = os.path.join(outdir, re.sub(r'[^\w\-]+', '_', name).strip('_') + '.csv')
    with open(fn, 'w', newline='') as f: csv.writer(f).writerows(rows)
    print(f'{name!r:30} -> {os.path.basename(fn):30} {len(rows):5} rows x {width:3} cols')
