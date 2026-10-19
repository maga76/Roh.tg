import json, struct, sys, os
def info(path):
    with open(path,'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        clen, ctype = struct.unpack('<II', f.read(8))
        j = json.loads(f.read(clen))
    print(f'== {os.path.basename(path)}  {os.path.getsize(path)//1024} KB  ext={j.get("extensionsUsed",[])}')
    nodes=j.get('nodes',[])
    def walk(i,d):
        n=nodes[i]; print('  '*d+f'- {n.get("name","?")}' + (f' mesh' if 'mesh' in n else '') + (f' t={[round(x,2) for x in n["translation"]]}' if 'translation' in n else '') + (f' s={[round(x,2) for x in n["scale"]]}' if 'scale' in n else ''))
        for c in n.get('children',[]): walk(c,d+1)
    for s in j.get('scenes',[]):
        for r in s['nodes']: walk(r,1)
    for a in j.get('accessors',[]):
        pass
    imgs=j.get('images',[]); print('  images:',[i.get('uri',i.get('mimeType')) for i in imgs])
for p in sys.argv[1:]: info(p)
