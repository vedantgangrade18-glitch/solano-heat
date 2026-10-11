import glob, os, re
root = os.path.dirname(os.path.abspath(__file__))
parts = []
for f in sorted(glob.glob(os.path.join(root, 'js', '*.js'))):
    parts.append(f"// ===== {os.path.basename(f)} =====\n" + open(f).read())
bundle = "(function () {\n'use strict';\n" + "\n".join(parts) + "\n})();"
shell = open(os.path.join(root, 'shell.html')).read()
assert '/*__BUNDLE__*/' in shell
out = shell.replace('/*__BUNDLE__*/', bundle)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist', 'solano-heat.html'), 'w').write(out)
open(os.path.join(root, 'dist', 'bundle.js'), 'w').write(bundle)
# local test page: wrapped in a document skeleton like the artifact host
test = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + out + '</body></html>')
open(os.path.join(root, 'dist', 'test.html'), 'w').write(test)
# standalone page for GitHub Pages / opening locally
cut = out.index('<div id="game"></div>')
head_part, body_part = out[:cut].strip(), out[cut:].strip()
index = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
         '<style>[hidden]{display:none!important}</style>\n' + head_part + '\n</head>\n<body>\n' + body_part + '\n</body>\n</html>\n')
open(os.path.join(root, 'index.html'), 'w').write(index)
print('page bytes', len(out))
