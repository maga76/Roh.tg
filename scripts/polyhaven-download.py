# Загрузка ресурсов Poly Haven по JSON-описанию файлов
import json, os, sys, urllib.request
FILES, OUT = sys.argv[1], sys.argv[2]
UA = {'User-Agent': 'TestDrive3D/1.0'}
def get(url, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst): return
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req) as r, open(dst, 'wb') as f: f.write(r.read())
def files(a): return json.load(open(os.path.join(FILES, a + '.json')))
HDRI = {'studio_small_09':'1k','kloofendal_48d_partly_cloudy_puresky':'2k','fouriesburg_mountain_midday':'2k',
        'mud_road_puresky':'2k','kloofendal_43d_clear_puresky':'2k','goegap':'2k','snowy_field':'2k'}
for a, r in HDRI.items():
    get(files(a)['hdri'][r]['hdr']['url'], f'{OUT}/hdri/{a}_{r}.hdr'); print('hdri', a)
TEX = {'asphalt_02':'2k','asphalt_track':'2k','aerial_grass_rock':'1k','forrest_ground_01':'1k','brown_mud_leaves_01':'1k',
       'rock_face_03':'1k','aerial_rocks_02':'1k','aerial_beach_01':'1k','snow_02':'1k'}
for a, r in TEX.items():
    d = files(a)
    for m, short in (('Diffuse','diff'),('nor_gl','nor_gl'),('arm','arm')):
        get(d[m][r]['jpg']['url'], f'{OUT}/textures/{a}/{a}_{short}_{r}.jpg')
    print('tex', a)
for a in ('rock_moss_set_01','namaqualand_boulder_02'):
    g = files(a)['gltf']['1k']['gltf']
    get(g['url'], f'{OUT}/models/{a}/{a}_1k.gltf')
    for rel, inc in g.get('include', {}).items():
        get(inc['url'], f'{OUT}/models/{a}/{rel}')
    print('model', a)
