"""Abre el visor en WebKit (motor de Safari) con tamaños de iPhone y reporta errores, desbordes y capturas.
Uso: xvfb-run -a /usr/bin/python3.12 pruebas/webkit_iphone.py "$PWD/dist/index.html" /carpeta/capturas
Necesita, desde apt: python3-gi, gir1.2-webkit2-4.1, gir1.2-gtk-3.0, python3-gi-cairo y xvfb."""
import sys, json, gi, cairo
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

HTML, OUT = sys.argv[1], sys.argv[2]
SIZES = [('390x844', 390, 844), ('375x667', 375, 667), ('320x568', 320, 568), ('844x390', 844, 390)]
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
PRE = """window.__errs=[];window.addEventListener('error',function(e){__errs.push(String(e.message)+' @'+e.lineno+':'+e.colno)});
window.addEventListener('unhandledrejection',function(e){__errs.push('promesa: '+e.reason)});"""
DIAG = """(function(){var d=document.documentElement,c=document.getElementById('sky'),w=document.getElementById('sky-wrap');
var r=w.getBoundingClientRect(),ink=0;try{var g=c.getContext('2d'),im=g.getImageData(0,0,c.width,c.height).data;for(var i=0;i<im.length;i+=4000){if(im[i]<120&&im[i+1]<120)ink++;}}catch(e){ink='err '+e}
var wide=[];document.querySelectorAll('body *').forEach(function(el){var b=el.getBoundingClientRect();if(b.right>innerWidth+1&&b.width>0)wide.push((el.id||el.className||el.tagName)+':'+Math.round(b.right))});
return JSON.stringify({errs:window.__errs,vw:innerWidth,vh:innerHeight,docW:d.scrollWidth,docH:d.scrollHeight,skyTop:Math.round(r.top+scrollY),skyH:Math.round(r.height),canvas:[c.width,c.height],inkSamples:ink,
chips:document.getElementById('chips').innerText.replace(/\\n/g,' '),fonts:Array.from(document.fonts).filter(function(f){return f.status==='loaded'}).length,
supports:{clip:CSS.supports('overflow-x','clip'),svh:CSS.supports('height','1svh'),mask:CSS.supports('mask','none')||CSS.supports('-webkit-mask','none'),dialog:typeof HTMLDialogElement},wide:wide.slice(0,8)})})()"""

results = {}
win = Gtk.OffscreenWindow()
ucm = WebKit2.UserContentManager()
ucm.add_script(WebKit2.UserScript.new(PRE, WebKit2.UserContentInjectedFrames.ALL_FRAMES, WebKit2.UserScriptInjectionTime.START, None, None))
wv = WebKit2.WebView.new_with_user_content_manager(ucm)
st = wv.get_settings(); st.set_user_agent(UA); st.set_enable_write_console_messages_to_stdout(True)
st.set_allow_file_access_from_file_urls(True)
win.add(wv); win.show_all()
queue = list(SIZES)

def next_size():
    if not queue:
        print(json.dumps(results, ensure_ascii=False, indent=1)); Gtk.main_quit(); return False
    name, w, h = queue[0]
    win.resize(w, h); wv.set_size_request(w, h)
    wv.load_uri('file://' + HTML + '#q-mujeres-rurales')
    return False

def on_load(view, ev):
    if ev == WebKit2.LoadEvent.FINISHED: GLib.timeout_add(3500, diag)

def diag():
    name = queue[0][0]
    def got(view, res, *a):
        try: results[name] = json.loads(view.evaluate_javascript_finish(res).to_string())
        except Exception as e: results[name] = {'evalerror': str(e)}
        wv.get_snapshot(WebKit2.SnapshotRegion.FULL_DOCUMENT, WebKit2.SnapshotOptions.NONE, None, snap, None)
    wv.evaluate_javascript(DIAG, -1, None, None, None, got)
    return False

def snap(view, res, *a):
    name = queue[0][0]
    try:
        surf = view.get_snapshot_finish(res); surf.write_to_png(f'{OUT}/wk_{name}.png')
    except Exception as e: results.setdefault(name, {})['snaperror'] = str(e)
    queue.pop(0); GLib.idle_add(next_size)

wv.connect('load-changed', on_load)
GLib.idle_add(next_size)
GLib.timeout_add_seconds(240, lambda: (print('TIMEOUT', json.dumps(results)), Gtk.main_quit()))
Gtk.main()
