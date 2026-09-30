#!/usr/bin/env python3
"""Write locales/en.json and ja.json. Edit the dicts below, then re-run."""
import json, pathlib
OUT = pathlib.Path(__file__).resolve().parent.parent / 'locales'
NOTE_M = {'en': 'Placeholder geometry and dimensions; replace with the real CAD before publishing.',
          'ja': 'ジオメトリと寸法は仮のものです。公開前に実際の CAD に差し替えてください。'}

# id: (title_en, text_en, title_ja, text_ja)
STEPS = {
 'orient-the-case': ('Orient the case', 'Place the enclosure base on the bench, open side up. The USB-C side is on the right.', 'ケースの向きを決める', 'ケース下部を開口部を上にして置きます。USB-C 側が右になります。'),
 'fit-the-battery': ('Fit the battery', 'Lower the LiPo cell into the left half of the base, label up. Route its lead toward the middle.', 'バッテリーを入れる', 'LiPo セルをラベルを上にして、ケース左側に入れます。リード線は中央側へ向けます。'),
 'fit-the-tube': ('Fit the GM tube', 'Seat the pancake Geiger–Müller tube in the right half of the base with its mica window facing up.', 'GM 管を入れる', 'パンケーキ型 GM 管を、マイカ窓を上にしてケース右側に置きます。'),
 'mount-the-standoffs': ('Mount the standoffs', 'Screw the four M3 standoffs into the corner posts of the base.', 'スペーサーを取り付ける', '4 本の M3 スペーサーをケースの四隅にねじ込みます。'),
 'seat-the-mainboard': ('Seat the mainboard', 'Lower the main PCB onto the standoffs and fasten it with four screws. The battery and tube sit underneath.', 'メイン基板を載せる', 'メイン基板をスペーサーに載せ、4 本のネジで固定します。バッテリーと GM 管は基板の下になります。'),
 'esp32-headers': ('ESP32 headers', 'Fit two 9-pin male headers under the ESP32 module, long ends down.', 'ESP32 のヘッダー', 'ESP32 モジュールの下に 9 ピンのオスヘッダーを 2 本、長い側を下にして差します。'),
 'solder-the-esp32': ('Solder the ESP32', 'Solder every header pin on the module’s top face.', 'ESP32 をはんだ付け', 'モジュール上面で、すべてのヘッダーピンをはんだ付けします。'),
 'seat-the-esp32': ('Seat the ESP32', 'Plug the module into the mainboard sockets, antenna toward the board edge.', 'ESP32 を装着', 'モジュールをメイン基板のソケットに差します。アンテナは基板の端側です。'),
 'build-the-gps': ('Build the GPS', 'Solder the six header pins of the GPS module. The ceramic patch antenna faces up.', 'GPS を組み立てる', 'GPS モジュールの 6 ピンをはんだ付けします。セラミックパッチアンテナは上向きです。'),
 'seat-the-gps': ('Seat the GPS', 'Plug the GPS module into its socket.', 'GPS を装着', 'GPS モジュールをソケットに差します。'),
 'hv-module': ('HV module', 'Solder the high-voltage supply to the mainboard and connect its output lead to the tube.', '高圧モジュール', '高圧電源モジュールをメイン基板にはんだ付けし、出力線を GM 管につなぎます。'),
 'display-and-usb': ('Display and USB-C', 'Solder the OLED display and the USB-C connector. The display must line up with the lid window.', 'ディスプレイと USB-C', 'OLED ディスプレイと USB-C コネクターをはんだ付けします。ディスプレイは上蓋の窓に合わせます。'),
 'connect-the-battery': ('Connect the battery', 'Solder the battery lead to the mainboard from underneath. Check polarity first.', 'バッテリーを接続', '基板の裏側からバッテリーのリード線をはんだ付けします。先に極性を確認してください。'),
 'close-the-case': ('Close the case', 'Lower the lid, display through the window, and fasten it.', '蓋を閉める', 'ディスプレイを窓に通して蓋を載せ、固定します。'),
 'assembly-complete': ('Assembly complete', 'Power on and check the display, GPS fix and counts before field use.', '組み立て完了', '電源を入れ、ディスプレイ・GPS 測位・カウントを確認してから使用してください。'),
}
NOTES = {'fit-the-battery': 'm', 'fit-the-tube': 'm', 'hv-module': ('info', 'Handle the HV module only with power off and the battery unplugged.', '高圧モジュールは電源オフ・バッテリー未接続で扱ってください。'),
         'connect-the-battery': ('info', 'Keep the lead short and insulated from the tube.', 'リード線は短くし、GM 管と絶縁してください。')}
PARTS = {'enclosure-base': ('Enclosure base', 'ケース下部'), 'lipo-battery': ('LiPo battery', 'LiPo バッテリー'), 'gm-tube': ('GM pancake tube', 'パンケーキ型 GM 管'),
         'm3-standoff': ('M3 standoff', 'M3 スペーサー'), 'main-pcb': ('Main PCB', 'メイン基板'), 'esp32-module': ('ESP32 module', 'ESP32 モジュール'),
         'male-header-9-pin': ('Male header, 9-pin', 'オスヘッダー 9 ピン'), 'gps-module': ('GPS module', 'GPS モジュール'), 'hv-module': ('HV supply module', '高圧電源モジュール'),
         'oled-display': ('OLED display', 'OLED ディスプレイ'), 'usb-c-connector': ('USB-C connector', 'USB-C コネクター'), 'lid': ('Lid with display window', '表示窓付き上蓋')}
CHAPTERS = {'case': ('Case', 'ケース'), 'power': ('Battery & tube', 'バッテリーと GM 管'), 'electronics': ('Electronics', '電子部品'), 'close': ('Closing up', '仕上げ')}
LABELS = {'front': ('front', '前面'), 'battery': ('battery', 'バッテリー'), 'window': ('mica window', 'マイカ窓'), 'antenna': ('antenna', 'アンテナ'),
          'hvLead': ('HV lead', '高圧線'), 'batteryPlus': ('battery +', 'バッテリー +')}
TOOLS = {'iron': ('Soldering iron', 'はんだごて'), 'pliers': ('Pliers', 'ラジオペンチ'), 'cutters': ('Flush cutters', 'ニッパー'), 'tape': ('Electrical tape', '絶縁テープ'),
         'stripper': ('Wire stripper', 'ワイヤーストリッパー'), 'screwdriver': ('Screwdriver', 'ドライバー')}
UI = {
 'pageTitle': ('bGeigie Zen Build', 'bGeigie Zen 組み立て'), 'description': ('Interactive 3D assembly instructions for the bGeigie Zen.', 'bGeigie Zen のインタラクティブ 3D 組み立て手順。'),
 'back': ('Safecast', 'Safecast'), 'product': ('bGeigie Zen · Assembly', 'bGeigie Zen · 組み立て'), 'coverKicker': ('Safecast · Build instructions', 'Safecast · 組み立て手順'),
 'coverTitle': ('bGeigie Zen', 'bGeigie Zen'), 'coverSub': ('Step-by-step 3D assembly: case, battery, GM tube, mainboard, GPS and display.', '3D で見る組み立て手順：ケース、バッテリー、GM 管、メイン基板、GPS、ディスプレイ。'),
 'credit': ('bGeigie Zen is a {creator} open hardware project. Viewer layout after the APS-II Sesame build guide.', 'bGeigie Zen は {creator} のオープンハードウェアです。ビューアーは APS-II の Sesame 組み立てガイドを参考にしています。'),
 'creditGithub': ('GitHub ↗', 'GitHub ↗'), 'creditDiscord': ('Community ↗', 'コミュニティ ↗'),
}
ref = json.load(open(pathlib.Path(__file__).with_name('ref_en.json'))) if pathlib.Path(__file__).with_name('ref_en.json').exists() else None

def build(i, code):
    d = json.loads(json.dumps(ref[code])) if ref else {}
    d['ui'].update({k: v[i] for k, v in UI.items()})
    d['tools'] = {k: v[i] for k, v in TOOLS.items()}
    d['labels'] = {k: v[i] for k, v in LABELS.items()}
    d['chapters'] = {k: v[i] for k, v in CHAPTERS.items()}
    d['parts'] = {k: v[i] for k, v in PARTS.items()}
    d['evidence']['model'] = d['evidence']['model']
    steps = {}
    for sid, v in STEPS.items():
        s = {'title': v[2 * i], 'text': v[2 * i + 1]}
        n = NOTES.get(sid)
        if n == 'm': s['notes'] = {'model': NOTE_M[code]}
        elif n: s['notes'] = {n[0]: n[1 + i]}
        steps[sid] = s
    d['steps'] = steps
    return d

for i, code in enumerate(('en', 'ja')):
    (OUT / f'{code}.json').write_text(json.dumps(build(i, code), ensure_ascii=False, indent=2) + '\n')
print('ok')
