import hashlib,json,sys,urllib.request
from pathlib import Path
root=Path(sys.argv[1]); target=sys.argv[2]; output=Path(sys.argv[3])
rows=[]
for f in sorted(root.rglob("*")):
 if not f.is_file(): continue
 relative=f.relative_to(root).as_posix()
 request=urllib.request.Request(target.rstrip("/")+"/"+relative,headers={"Cache-Control":"no-cache"})
 with urllib.request.urlopen(request,timeout=45) as response:
  body=response.read(); status=response.status
 local=f.read_bytes()
 rows.append({"file":relative,"status":status,"localSha256":hashlib.sha256(local).hexdigest(),"publicSha256":hashlib.sha256(body).hexdigest(),"matches":local==body})
result={"url":target,"files":rows,"count":len(rows),"allMatch":all(r["status"]==200 and r["matches"] for r in rows)}
output.write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps({k:v for k,v in result.items() if k!="files"}))
if not result["allMatch"]: print(json.dumps([r for r in rows if not r["matches"]]));sys.exit(1)
