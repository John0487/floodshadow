// Compatibility for the original beta URL; the application now runs with Vite.
import http from 'node:http';
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5174');
 res.writeHead(302,{Location:`http://127.0.0.1:5174${url.pathname}${url.search}`,'Cache-Control':'no-store'}).end();
}).listen(5173,'127.0.0.1',()=>console.log('Original beta URL redirects to http://127.0.0.1:5174/'));
