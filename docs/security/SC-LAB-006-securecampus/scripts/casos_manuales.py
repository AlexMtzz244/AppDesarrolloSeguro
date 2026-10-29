import sys, tempfile, os
sys.path.insert(0, sys.argv[1])
from src.db import seed_demo
from src.app import create_app
d=tempfile.mkdtemp(); p=os.path.join(d,'t.db'); seed_demo(p)
app=create_app(p,testing=True)
def login(c,u):
    r=c.post('/login',json={'username':u,'password':'Laboratorio2026!'}); return {'X-CSRF-Token':r.get_json()['csrf_token']}
print("== Actividad B (profe_ana PUT /grades/3/10)")
for v in [85,'99.50',150,'NaN',99.999,True,'1e2',' 70 ','abc','']:
    c=app.test_client(); h=login(c,'profe_ana'); r=c.put('/grades/3/10',json={'grade':v},headers=h)
    print(f"{v!r:10} -> {r.status_code} {r.get_json()}")
print("== Actividad C")
def caso(n,u,m,url,csrf=True,body=None):
    c=app.test_client(); h=login(c,u) if u else {}
    if not csrf: h={}
    r=getattr(c,m)(url,json=body,headers=h); print(f"{n:28} {m.upper()} {url} -> {r.status_code} {r.get_json()}")
caso('Profesor propio / PUT','profe_ana','put','/grades/3/10',body={'grade':'90'})
caso('Profesor ajeno / PUT','profe_ana','put','/grades/4/20',body={'grade':'90'})
caso('Profesor ajeno / GET','profe_ana','get','/grades/4/20')
caso('Estudiante ajeno / GET','alumna_eli','get','/grades/4/20')
caso('Estudiante propio / GET','alumna_eli','get','/grades/3/10')
caso('Estudiante propio / PUT','alumna_eli','put','/grades/3/10',body={'grade':'100'})
caso('Sin sesion / GET',None,'get','/grades/3/10')
caso('Sin CSRF / PUT','profe_ana','put','/grades/3/10',csrf=False,body={'grade':'90'})
caso('Admin / PUT','admin_demo','put','/grades/3/10',body={'grade':'90'})
caso('Admin / GET','admin_demo','get','/grades/3/10')
caso('Grupo cruzado alumno 4 en g10','profe_ana','put','/grades/4/10',body={'grade':'90'})
print("== Sesion / logout")
c=app.test_client(); r=c.post('/login',json={'username':'profe_ana','password':'Laboratorio2026!'})
print('Set-Cookie:', r.headers.get('Set-Cookie').split(';',1)[1])
h={'X-CSRF-Token':r.get_json()['csrf_token']}
print('logout sin CSRF ->', c.post('/logout').status_code)
print('logout ->', c.post('/logout',headers=h).status_code, '; GET despues ->', c.get('/grades/3/10').status_code)
print('login malo ->', app.test_client().post('/login',json={'username':'profe_ana','password':'x'}).get_json())
print('login usuario inexistente ->', app.test_client().post('/login',json={'username':'nadie','password':'x'}).get_json())
import sqlite3
con=sqlite3.connect(p)
print('sessions row:', con.execute('select token_hash,user_id,length(csrf_token),expires_at from sessions limit 1').fetchone())
print('users row:', con.execute('select username,password_hash from users limit 1').fetchone())
print('outbox:', con.execute('select * from notification_outbox').fetchall()[:3])
print("== Errores (app no testing)")
app2=create_app(p,testing=False); c=app2.test_client()
r=c.post('/login',data='{malformed',headers={'Content-Type':'application/json'}); print('json malformado ->',r.status_code,r.get_data(as_text=True)[:120])
print('ruta inexistente ->', c.get('/grades/x/y').status_code, c.get('/grades/x/y').get_data(as_text=True)[:80])
