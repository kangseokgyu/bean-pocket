import concurrent.futures,hashlib,json,pathlib,sys,urllib.request
root=pathlib.Path(sys.argv[1])
base="https://kangseokgyu.github.io/bean-pocket/"
paths=["index.html","ui/view.mjs","styles.css","sw.js"]
def check(path):
    request=urllib.request.Request(base+path,headers={"Cache-Control":"no-cache"})
    with urllib.request.urlopen(request,timeout=30) as response:
        actual=response.read(); status=response.status
    expected=(root/path).read_bytes()
    return {"path":path,"status":status,"sha256":hashlib.sha256(actual).hexdigest(),"matches_local":actual==expected}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results=list(executor.map(check,paths))
print(json.dumps(results,ensure_ascii=False,indent=2))
sys.exit(0 if all(r["status"]==200 and r["matches_local"] for r in results) else 1)
