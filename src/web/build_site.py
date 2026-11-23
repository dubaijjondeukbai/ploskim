# -*- coding: utf-8 -*-
"""플로스킴 소개 페이지 빌드 (한 파일 HTML, PC·모바일 겸용). 저장소 맨 위의 index.html 을 만든다.
제품 소개, 3D 모델, 가격, 절감 계산, 폐식용유 수거 연결(공유 기록 또는 이 기기 저장), 시작 지역 지도, 문의."""
import json, os
D = os.path.dirname(os.path.abspath(__file__)) + "/"
ROOT = os.path.abspath(os.path.join(D, "..", "..")) + "/"
IM = json.load(open(D + "imgs.json"))
VIEWER = open(D + "viewer_bundle.js", encoding="utf-8").read().replace("</script", "<\\/script")
CSS = open(D + "site2.css", encoding="utf-8").read()
JS = open(D + "site2.js", encoding="utf-8").read().replace("</script", "<\\/script")
BODY = open(D + "site2_body.html", encoding="utf-8").read()

HTML = '''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>플로스킴 소개 페이지</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
__CSS__
</style></head>
<body>
__BODY__
<script>
__JS__
</script>
<script type="module">
__VIEWER__
</script>
</body></html>
'''
out = HTML.replace("__CSS__", CSS).replace("__BODY__", BODY).replace("__JS__", JS)
for k in ("HERO", "KITCHEN", "OPEN", "DRAWING", "MAP"): out = out.replace("__%s__" % k, IM[k])
out = out.replace("__VIEWER__", VIEWER)
assert "__" not in out.split("<script type=\"module\">")[0].replace("__proto__", ""), "남은 자리표시자가 있습니다"
open(ROOT + "index.html", "w", encoding="utf-8").write(out)
print("site2", len(out.encode("utf-8")) // 1024, "KB")
