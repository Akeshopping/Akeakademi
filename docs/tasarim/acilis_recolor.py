#!/usr/bin/env python3
"""Açılış (acilis/) dosyalarını yeni AKE Ritmi paletine eşler. Idempotent. Yazı tipi base64'üne dokunmaz."""
import re,pathlib,sys
R=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent.parent.parent)/'acilis'
HEX={'171715':'28232c','1c1b18':'28232c','06111f':'28232c','1f3a2f':'3a3340','30302b':'3a3340',
 'f5f1e8':'f8f5f0','f4efe4':'f8f5f0','f5f0e6':'f8f5f0','f3efe6':'f8f5f0','fbf8f1':'ffffff','fdfcf8':'ffffff',
 'ede6d7':'f1ece4','ede7da':'f1ece4','e0d8c8':'e8e1d9','d8d0c2':'e8e1d9','e6dfd1':'e8e1d9',
 '254236':'b73f36','e2e8dc':'f9e5e1','d5ddcf':'f9e5e1','b69a68':'d94f43','c5a572':'f27d6d','f1dfb6':'fad6d0','f3e6c9':'fad6d0',
 '6f5a2f':'a0352d','4b483f':'5c5560','66625a':'6b6370','1d6b4a':'476650','e2f1ea':'e6eee8','a8372a':'9e1b4b','f8e5e9':'fbe9ee',
 'a86a10':'7a4300','fbefd9':'fbebd6','b4324b':'9e1b4b','17785f':'476650','e5c58c':'fad6d0'}
HEX0X={'2b2a24':'3a3340','2a2a26':'3a3340','1c1c19':'221e27','181816':'221e27','151513':'1e1a22','050504':'0e0b10','b69a68':'d94f43',
 'f1dfb6':'fad6d0','fff3e0':'fff3ef','f5f1e8':'f8f5f0','8fb3a0':'f27d6d','e3cfa0':'e0b050','d5ddcf':'5fc4cc','7fae96':'c79be0'}
RGBA={'197,165,114':'242,125,109','255,236,205':'250,214,208','255,230,195':'250,214,208','255,225,190':'250,214,208','255,240,214':'250,214,208','255,240,215':'250,214,208',
 '13,27,51':'40,35,44','6,17,31':'40,35,44','244,239,228':'248,245,240','245,240,230':'248,245,240','23,23,21':'40,35,44','90,70,40':'160,53,45','29,107,74':'71,102,80','23,120,95':'71,102,80'}
n=0
for f in R.rglob('*'):
    if not f.is_file() or f.suffix not in('.js','.css','.html') or 'vendor' in f.parts or f.name=='RoomEnvironment.js': continue
    s=f.read_text(encoding='utf8'); o=s
    # ders yolu ışıkları: koyu zeminde ders renkleri (Türkçe, Matematik, Fen, Sosyal)
    s=s.replace('[0x7fae96, 0xB69A68, 0xD5DDCF, 0xE3CFA0]','[0xC79BE0, 0x8FB4F0, 0x5FC4CC, 0xE0B050]')
    if f.name=='ortak.js': s=s.replace('#b69a68','#f27d6d')          # son logo degradesi koyu zeminde açık mercan
    s=re.sub(r'#([0-9a-fA-F]{6})\b',lambda m:'#'+HEX.get(m.group(1).lower(),m.group(1)),s)
    s=re.sub(r'0x([0-9a-fA-F]{6})\b',lambda m:'0x'+HEX0X.get(m.group(1).lower(),m.group(1)),s)
    s=re.sub(r'rgba\((\d+),(\d+),(\d+)',lambda m:'rgba('+RGBA.get(m.group(0)[5:],m.group(0)[5:])+'',s) if False else s
    s=re.sub(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)',lambda m:'rgba('+RGBA.get(f'{m.group(1)},{m.group(2)},{m.group(3)}',f'{m.group(1)},{m.group(2)},{m.group(3)}'),s)
    s=re.sub(r'"(255,24\d,2\d\d)"',lambda m:'"250,214,208"' if m.group(1) in('255,240,215','255,240,214') else m.group(0),s)
    if s!=o: f.write_text(s,encoding='utf8'); n+=1; print('güncellendi',f.relative_to(R))
print('dosya',n)
