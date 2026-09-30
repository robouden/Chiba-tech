#!/usr/bin/env python3
"""Write locales/en.json and locales/ja.json (edit the tables below, then re-run).

English wording follows "bGeigieZen Kit Assembly for V4.x boards" (2026-04-06).
Shared UI strings come from scripts/ref_en.json (English/Japanese `ui`, `evidence`).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / 'locales'
REF = json.loads((HERE / 'ref_en.json').read_text())

# id: (title_en, text_en, title_ja, text_ja)
STEPS = {
 'orient-the-pcb': ('Orient the PCB', 'Lay the bGeigieZen V4.x printed circuit board on the bench with the top (component) side up.',
                    '基板の向きを決める', 'bGeigieZen V4.x のプリント基板を、部品面（表側）を上にして作業台に置きます。'),
 'place-the-header': ('Place the 2×15 header', 'Insert the 2×15 pin header into the J1 holes, long side up.',
                      '2×15 ヘッダーを置く', '2×15 ピンヘッダーを J1 の穴に、長い側を上にして差し込みます。'),
 'dry-fit-the-controller': ('Dry-fit the controller', 'Line up the header pins with the sockets in the M5Stack CoreS3 and press the controller flush against the top of the PCB. Take care not to bend the pins.',
                            'コントローラーを仮合わせ', 'ヘッダーのピンを M5Stack CoreS3 のソケットに合わせ、コントローラーを基板の上面にぴったり押し込みます。ピンを曲げないよう注意してください。'),
 'fasten-with-screws': ('Fasten with two screws', 'Turn the assembly over. Insert the two M3 screws into the captive nuts in the controller and tighten them loosely. You will remove the controller again later.',
                        'ネジ 2 本で固定', '全体を裏返します。M3 ネジ 2 本をコントローラーのナットに差し込み、軽く締めます。コントローラーは後で取り外します。'),
 'solder-the-header': ('Solder the header', 'Solder the header pins to the PCB. The solder should look as if it flowed up the pins and around the PCB rings (pads).',
                       'ヘッダーをはんだ付け', 'ヘッダーのピンを基板にはんだ付けします。はんだがピンを伝って基板のリング（パッド）の周りに広がった状態が目安です。'),
 'remove-the-controller': ('Remove the controller', 'Unscrew the two screws and take the controller off for the rest of the assembly.',
                           'コントローラーを外す', 'ネジ 2 本を外し、残りの組み立てのためにコントローラーを取り外します。'),
 'battery-clips': ('Battery clips', 'Fit the two battery clips on the underside of the board, following the outline of the 18650 battery. Clench the pins slightly, like a staple, so each clip stays put and lies flat.',
                   'バッテリークリップ', '基板の裏側に、18650 電池の外形に合わせてクリップ 2 個を取り付けます。ピンをホチキスのように少し折り曲げ、クリップが外れず平らに載るようにします。'),
 'solder-the-clips': ('Solder the clips', 'Solder both clips from the top of the board. The solder must flow evenly over the pins and into the holes.',
                      'クリップをはんだ付け', '基板の上側から両方のクリップをはんだ付けします。はんだがピンと穴に均一に流れるようにします。'),
 'protection-diode': ('Protection diode', 'Match the diode to the outline on the PCB: the white or silver stripe lines up with the thick line, next to the square-pad hole. Bend the leads away from the body, insert them, solder from the top and trim the excess.',
                      '保護ダイオード', 'ダイオードを基板の外形に合わせます。白または銀の帯を太い線（角パッドの穴の隣）に合わせます。リードを本体から離して曲げ、差し込み、上側からはんだ付けして余分を切ります。'),
 'fuse-holder': ('Fuse holder', 'Insert the fuse holder into the four holes marked “FUSE 2A”, flush with the board, and solder all four pins. The fuse itself is inserted later.',
                 'ヒューズホルダー', 'ヒューズホルダーを「FUSE 2A」の 4 つの穴に基板と密着するよう差し込み、4 本のピンをはんだ付けします。ヒューズは後で入れます。'),
 'charger-cable': ('Charger cable', 'Insert the receptacle pins into the “Qi-charger” holes with the red wire closest to the board edge, and solder them. Use the wires as a handle so the receptacle sits flush.',
                   '充電ケーブル', 'レセプタクルのピンを「Qi-charger」の穴に、赤い線が基板の端に最も近くなる向きで差し込み、はんだ付けします。線を持ち手にすると密着させやすくなります。'),
 'insulate-the-clips': ('Insulate the clips (optional)', 'Slip the pre-cut heat-shrink tubing over the sides of the battery clips, red for positive (+) and black for negative (−), leaving 1–2 mm above the metal, then shrink it with heat. Leave the end contacts bare.',
                        'クリップを絶縁（任意）', 'あらかじめ切ってある熱収縮チューブをクリップの側面にかぶせます。赤は＋、黒は−です。金属の上に 1〜2 mm 残し、熱で収縮させます。端の接点は覆いません。'),
 'safepulse-pins': ('Safepulse pins', 'Place three pins in J4 and two in J5, with the long end and its plastic carrier on the underside of the board (the battery side).',
                    'Safepulse 用ピン', 'J4 に 3 本、J5 に 2 本のピンを、長い側とプラスチックの台を基板の裏側（電池側）にして差し込みます。'),
 'gps-wires': ('GPS wires', 'Insert the four prepared wires into the four middle holes of J3 and solder them. The two outer positions stay empty. The GPS module lies upside-down next to J3 for now.',
               'GPS の配線', '用意された 4 本の線を J3 の中央 4 つの穴に差し込み、はんだ付けします。両端の 2 か所は使いません。GPS モジュールは今は J3 の隣に裏返して置きます。'),
 'solder-the-safepulse': ('Solder the Safepulse', 'Place the Safepulse on the pins, leaving only a short length protruding through the holes, and solder.',
                          'Safepulse をはんだ付け', 'Safepulse をピンに載せ、穴から出るピンをわずかにしてはんだ付けします。'),
 'mount-the-gps': ('Mount the GPS', 'Peel the wax paper off the two-sided adhesive pad and press the GPS module onto its outline on the board.',
                   'GPS を取り付け', '両面テープの剥離紙をはがし、GPS モジュールを基板の外形に合わせて押し付けます。'),
 'mount-the-controller': ('Mount the controller', 'Press the controller onto the header pins, then fasten it with the two machine screws. Tighten them, but do not overtorque.',
                          'コントローラーを取り付け', 'コントローラーをヘッダーのピンに押し込み、ネジ 2 本で固定します。締めすぎないでください。'),
 'place-the-sensor': ('Place the LND 7317 sensor', 'Set the sensor in the back cover of the case, angled so the large anode post is near the case edge, away from the Safepulse. Press the board onto the sensor’s adhesive foam pad to make a single assembly.',
                      'LND 7317 センサーを置く', 'センサーをケース背面のカバーに入れます。大きな陽極端子がケースの端側（Safepulse から遠い側）に来るよう傾けます。基板をセンサーの粘着フォームに押し付けて一体にします。'),
 'wire-the-anode': ('Wire the anode', 'Tin the bare end of the red anode wire, plug its socket onto the anode post and solder the other end into one of the two “Anode” holes on the Safepulse. Cover the anode post with heat-shrink tubing.',
                    '陽極の配線', '赤い陽極線の先端にはんだメッキ（予備はんだ）をし、ソケットを陽極端子に差し、反対側を Safepulse の「Anode」の穴のどちらかにはんだ付けします。陽極端子は熱収縮チューブで覆います。'),
 'wire-the-cathode': ('Wire the cathode', 'Cover the bare cathode wire with the 5 cm (2 in) heat-shrink tubing and shrink it. Trim any excess bare wire and solder the end into the “Cathode” hole near the J4 pins.',
                      '陰極の配線', '裸の陰極線に 5 cm の熱収縮チューブをかぶせて収縮させます。余分な裸線を切り、先端を J4 のピン近くの「Cathode」の穴にはんだ付けします。'),
 'preliminary-test': ('Preliminary test', 'Power the controller over USB. The boot screen warns that the SD card is missing: ignore it and press Continue (top right). On the Drive screen, confirm the sensor is registering counts.',
                      '動作テスト', 'USB でコントローラーに給電します。起動画面に SD カードがないという警告が出ますが、無視して右上の「Continue」を押します。Drive 画面でセンサーがカウントしていることを確認します。'),
 'wireless-charger': ('Wireless Qi charger', 'Place the coil and interface module on the underside of the rubber liner, against the bottom of the case. Solder the battery connector wires to the module’s BAT + (red) and − (black) holes, pass the connector through a hole punched in the liner and plug it into the board. Stick the coil, face up, to the bottom of the case.',
                      'ワイヤレス充電（Qi）', 'コイルとインターフェースモジュールをゴムライナーの裏側、ケース底面に置きます。電池コネクターの線をモジュールの BAT +（赤）と −（黒）にはんだ付けし、ライナーに開けた穴を通して基板に差し込みます。コイルは表を上にしてケース底に貼ります。'),
 'card-and-battery': ('Card and battery', 'Insert the preconfigured microSD card into the slot at the top of the controller. Then insert the 18650 battery (not in the kit), observing the + and − polarity: a 65 mm holder takes an unprotected flat-top cell, a 69 mm holder a protected button-top cell.',
                      'カードと電池', '設定済みの microSD カードをコントローラー上部のスロットに差します。次に 18650 電池（キットには含まれません）を＋−に注意して入れます。65 mm のホルダーには保護回路なしのフラットトップ、69 mm のホルダーには保護回路付きのボタントップを使います。'),
 'place-in-the-case': ('Place in the case', 'Lower the completed assembly into the Pelican 1015 Micro Case and latch the lid shut. The fit is quite tight, so the device does not rattle in the case.',
                       'ケースに入れる', '完成した組み立て品を Pelican 1015 マイクロケースに入れ、蓋を閉じてラッチをかけます。かなりぴったりなので、ケース内でガタつきません。'),
 'assembly-complete': ('Assembly complete', 'Open the case and hold the power button (right side of the controller) for half a second to switch on; hold it for three seconds to shut down. The boot screen shows the device ID.',
                       '組み立て完了', 'ケースを開け、電源ボタン（コントローラー右側）を約 0.5 秒押すと起動、3 秒押すと終了します。起動画面にデバイス ID が表示されます。'),
}

# id: {kind: (en, ja)}
NOTES = {
 'place-the-header': {'info': ('The short end of the header pins must protrude from the bottom of the board.', 'ヘッダーピンの短い側が基板の裏側に出るようにします。')},
 'dry-fit-the-controller': {'info': ('Some older kits use the M5Stack Core2 v1.1. It works the same; only its back cover differs and must be removed with the small Allen key from the kit.', '古いキットには M5Stack Core2 v1.1 が使われています。動作は同じで、背面カバーだけが異なり、付属の小さな六角レンチで外す必要があります。')},
 'solder-the-header': {'info': ('Some of these joints end up hidden under the controller in the final assembly.', 'これらのはんだ付けの一部は、完成後コントローラーの下に隠れます。')},
 'battery-clips': {'info': ('The pins should protrude evenly on the top side of the board.', 'ピンは基板の上側に均等に出るようにします。')},
 'solder-the-clips': {'info': ('The clip pins need a lot of heat. If the solder does not flow readily, use a more powerful iron or a second iron at the same temperature. A minor gap is acceptable if the rest of the pin has a continuous fillet.', 'クリップのピンは多くの熱を必要とします。はんだが流れにくいときは、より強力なこてか、同じ温度の 2 本目のこてを使います。残りのピンに連続したフィレットがあれば、わずかな隙間は問題ありません。')},
 'protection-diode': {'info': ('With the fuse, the diode protects against a battery inserted backwards. Bend the leads with two pairs of pliers so the body is not stressed, and wear safety glasses when clipping: cut leads can fly.', 'ダイオードはヒューズと組み合わせて、電池の逆挿入から保護します。本体に力がかからないよう、ペンチ 2 本でリードを曲げます。切るときは保護メガネを着用してください。切ったリードが飛ぶことがあります。')},
 'charger-cable': {'info': ('Observe the polarity: the red wire goes closest to the board edge.', '極性に注意します。赤い線は基板の端に最も近い側です。')},
 'insulate-the-clips': {'info': ('The tubing lifts the battery slightly in the clips and pushes the board up in the case. Without kit tubing, use 6 mm (¼ in) tubing cut to 18–20 mm.', 'チューブの厚みで電池がクリップの中でわずかに高くなり、基板がケース内で持ち上がります。チューブがないときは 6 mm（¼ インチ）のチューブを 18〜20 mm に切って使います。')},
 'safepulse-pins': {'info': ('Do not solder the Safepulse in place until the GPS wires are soldered.', 'GPS の配線がはんだ付けされるまで、Safepulse は取り付けないでください。'),
                    'model': ('Pin length and carrier height are illustrative.', 'ピンの長さと台の高さはイメージです。')},
 'gps-wires': {'info': ('Do not peel the wax paper from the module’s adhesive pad yet. The outer two wires (positions 1 and 6) are cut short at the module and are not used.', 'モジュールの粘着パッドの剥離紙はまだはがしません。外側 2 本（位置 1 と 6）はモジュール側で短く切られており、使いません。'),
              'model': ('Wire routing and colours are illustrative.', '配線の取り回しと色はイメージです。')},
 'solder-the-safepulse': {'info': ('Keep this order: the GPS and Safepulse joints are in the same area on opposite sides of the board, and fitting either module first would block the other.', 'この順序を守ってください。GPS と Safepulse のはんだ付けは基板の反対側の同じ場所にあり、どちらかを先に取り付けるともう一方が取り付けられなくなります。')},
 'mount-the-gps': {'info': ('The module attaches with a foam pad that has adhesive on both faces. It goes on after the Safepulse pins are soldered.', 'モジュールは両面粘着のフォームパッドで固定します。Safepulse のピンをはんだ付けした後に取り付けます。')},
 'mount-the-controller': {'warning': ('Do not overtorque the screws.', 'ネジを締めすぎないでください。')},
 'place-the-sensor': {'warning': ('Keep the protective cover on the sensor at all times. The mica membrane is very delicate; a puncture cannot be repaired.', 'センサーの保護カバーは常に付けたままにしてください。雲母膜は非常に薄く、穴が開くと修理できません。'),
                      'model': ('The case is not modelled: the sensor is shown fixed to the underside of the board.', 'ケースはモデル化していません。センサーは基板の裏側に固定した状態で表示しています。')},
 'wire-the-anode': {'info': ('Tinning keeps stray strands from shorting elsewhere on the board. Either Anode hole works; they are connected internally. The anode carries 500 V, so keep the post covered.', '予備はんだをすることで、はみ出した素線が基板上でショートするのを防ぎます。Anode の穴はどちらでも構いません（内部でつながっています）。陽極には 500 V がかかるので、端子は必ず覆ってください。'),
                    'model': ('Wire routing is illustrative.', '配線の取り回しはイメージです。')},
 'wire-the-cathode': {'info': ('You may need to trim excess bare wire before soldering it to the Safepulse.', 'Safepulse にはんだ付けする前に、余分な裸線を切る必要がある場合があります。'),
                      'model': ('Wire routing is illustrative.', '配線の取り回しはイメージです。')},
 'preliminary-test': {'info': ('The GPS should answer the controller even without a position fix.', 'GPS は位置が確定していなくてもコントローラーと通信できます。')},
 'wireless-charger': {'info': ('Punch the hole offset so the module stays centred. Observe the polarity.', 'モジュールが中央に来るよう、穴は少しずらして開けます。極性に注意してください。'),
                      'model': ('Coil and module shapes and positions are illustrative; the liner and case are not shown.', 'コイルとモジュールの形状と位置はイメージです。ライナーとケースは表示していません。')},
 'place-in-the-case': {'model': ('Only the back half of the case is modelled; the lid is not shown.', 'ケースは背面側のみモデル化しています。蓋は表示していません。')},
 'card-and-battery': {'warning': ('Never short-circuit an 18650. If it gets hot, put it in a closed metal container.', '18650 電池を絶対にショートさせないでください。熱くなったら、蓋つきの金属容器に入れてください。'),
                      'model': ('The card and its slot position are illustrative.', 'カードとスロットの位置はイメージです。')},
}
CHECKS = {
 'preliminary-test': (['Boot screen appears', 'Drive screen shows counts from the sensor', 'GPS power light is on and flashes once a second'],
                      ['起動画面が表示される', 'Drive 画面でセンサーのカウントが表示される', 'GPS の電源ランプが点灯し、1 秒ごとに点滅する']),
}
PARTS = {
 'pcb': ('bGeigieZen PCB V4.x', 'bGeigieZen 基板 V4.x'), 'header-2x15': ('Pin header, 2×15', 'ピンヘッダー 2×15'),
 'm5-cores3': ('M5Stack CoreS3 controller', 'M5Stack CoreS3 コントローラー'), 'm3-screw': ('M3 Phillips truss head screw', 'M3 なべ（トラス）ネジ'),
 'battery-clip': ('Battery holder clip', 'バッテリーホルダークリップ'), 'diode': ('Battery protection diode', '電池保護ダイオード'),
 'fuse-holder': ('Fuse holder and 2 A fuse', 'ヒューズホルダーと 2 A ヒューズ'), 'qi-connector': ('Charger cable (receptacle and plug)', '充電ケーブル（レセプタクルとプラグ）'),
 'pin-header': ('Pin header (Safepulse)', 'ピンヘッダー（Safepulse 用）'), 'gps-wire': ('GPS wire', 'GPS 用の線'),
 'safepulse': ('Safepulse 500 V source', 'Safepulse 500 V 電源'), 'gps-module': ('GPS receiver module', 'GPS 受信モジュール'),
 'lnd-7317': ('LND 7317 Geiger-Müller pancake sensor', 'LND 7317 パンケーキ型 GM センサー'), 'anode-wire': ('Sensor high-voltage wire (anode)', 'センサー高圧線（陽極）'),
 'cathode-wire': ('Cathode wire and heat-shrink tubing', '陰極線と熱収縮チューブ'), 'qi-receiver': ('Wireless charge receiver (coil and module)', 'ワイヤレス充電レシーバー（コイルとモジュール）'),
 'microsd-card': ('Preconfigured microSD card', '設定済み microSD カード'), 'pelican-1015': ('Pelican 1015 Micro Case', 'Pelican 1015 マイクロケース'),
 'battery-18650': ('18650 Li-Ion battery (not included)', '18650 リチウムイオン電池（付属しません）'),
}
CHAPTERS = {'header': ('Controller header', 'コントローラーのヘッダー'), 'power': ('Battery & power', '電池と電源'), 'hv': ('Safepulse & GPS', 'Safepulse と GPS'),
            'controller': ('Controller', 'コントローラー'), 'sensor': ('Sensor', 'センサー'), 'charger': ('Qi charger', 'Qi 充電'), 'finish': ('Finishing', '仕上げ')}
TOOLS = {'iron': ('Soldering iron', 'はんだごて'), 'cutters': ('Flush cutters', 'ニッパー'), 'pliers': ('Pliers', 'ペンチ'),
         'screwdriver': ('Phillips screwdriver', 'プラスドライバー'), 'heatgun': ('Heat source (heat-shrink)', '熱源（熱収縮チューブ用）'), 'stripper': ('Wire stripper', 'ワイヤーストリッパー')}
EVIDENCE = {'manual': (('Manual', 'The step comes from the V4.x assembly manual'), ('マニュアル', 'V4.x 組み立てマニュアルの手順')),
            'cad': (('CAD', 'Geometry from the bGeigieZen 3D model'), ('CAD', 'bGeigieZen の 3D モデルの形状')),
            'model': (('Modelled', 'Generated illustration; not measured'), ('モデル', '生成したイメージ（実測ではありません）'))}
UI = {
 'pageTitle': ('bGeigieZen Build | Safecast', 'bGeigieZen 組み立て | Safecast'),
 'description': ('Interactive 3D assembly instructions for the Safecast bGeigieZen V4.x kit.', 'Safecast bGeigieZen V4.x キットのインタラクティブ 3D 組み立て手順。'),
 'back': ('Safecast', 'Safecast'), 'product': ('bGeigieZen V4.x · Kit', 'bGeigieZen V4.x · キット'),
 'coverKicker': ('Safecast · Kit assembly', 'Safecast · キット組み立て'), 'coverTitle': ('bGeigieZen', 'bGeigieZen'),
 'coverSub': ('Geiger counter kit: M5Stack CoreS3, LND 7317 sensor, Safepulse HV supply, GPS and an 18650 cell on one board.',
              'ガイガーカウンターキット：M5Stack CoreS3、LND 7317 センサー、Safepulse 高圧電源、GPS、18650 電池を 1 枚の基板に。'),
 'credit': ('bGeigieZen is an open-source Geiger counter by {creator}. Viewer layout after the APS-II Sesame build guide.',
            'bGeigieZen は {creator} のオープンソースのガイガーカウンターです。ビューアーは APS-II の Sesame 組み立てガイドを参考にしています。'),
 'creditGithub': ('GitHub ↗', 'GitHub ↗'), 'creditDiscord': ('Support forum ↗', 'サポートフォーラム ↗'),
}


def build(i, code):
    d = json.loads(json.dumps(REF[code]))
    d['ui'].update({k: v[i] for k, v in UI.items()})
    d['tools'] = {k: v[i] for k, v in TOOLS.items()}
    d['chapters'] = {k: v[i] for k, v in CHAPTERS.items()}
    d['parts'] = {k: v[i] for k, v in PARTS.items()}
    d['labels'] = {}
    d['evidence'] = {k: {'short': v[i][0], 'long': v[i][1]} for k, v in EVIDENCE.items()}
    steps = {}
    for sid, v in STEPS.items():
        s = {'title': v[2 * i], 'text': v[2 * i + 1]}
        if NOTES.get(sid):
            s['notes'] = {kind: txt[i] for kind, txt in NOTES[sid].items()}
        if sid in CHECKS:
            s['checks'] = CHECKS[sid][i]
        steps[sid] = s
    d['steps'] = steps
    return d


for i, code in enumerate(('en', 'ja')):
    (OUT / f'{code}.json').write_text(json.dumps(build(i, code), ensure_ascii=False, indent=2) + '\n')
print('ok')
