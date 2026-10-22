// Hostinger sering memakai UTC; pakai WIB untuk seluruh tanggal transaksi JSA.
process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),mysql=require('mysql2/promise');
const ROOT=__dirname,PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||'0.0.0.0';
const ADMIN_USERNAME=process.env.ADMIN_USERNAME||'admin',ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'GANTI_PASSWORD_ADMIN',OWNER_PASSWORD=process.env.OWNER_PASSWORD||'',ADMIN_API_TOKEN=process.env.ADMIN_API_TOKEN||'',SESSION_SECRET=process.env.ADMIN_SESSION_SECRET||ADMIN_API_TOKEN||ADMIN_PASSWORD;
const BAHAN=['Sembako','Bahan Pokok','Bahan Kue','Bumbu','Garam','Kacang','Kecap','Makanan','Makanan Instant','Minyak','Penyedap','Saos','Tepung','SUSU'];
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
let pool; const buckets=new Map();
function db(){if(!pool){if(!process.env.DB_HOST||!process.env.DB_NAME||!process.env.DB_USER||!process.env.DB_PASSWORD)throw Error('DB_HOST, DB_NAME, DB_USER, dan DB_PASSWORD wajib diisi.');pool=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:'utf8mb4',waitForConnections:true,connectionLimit:8});}return pool}
async function q(sql,v=[]){const [r]=await db().execute(sql,v);return r} const j=(v,f=null)=>{try{return JSON.parse(v)}catch{return f}}; const ph=a=>a.map(()=>'?').join(',');
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':process.env.ALLOWED_ORIGIN||'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Admin-Token, Authorization'});res.end(JSON.stringify(body))}
function sqlDate(value){if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;return String(value||'').slice(0,10)}
function body(req){return new Promise((ok,no)=>{let d='';req.on('data',x=>{d+=x;if(d.length>1e7){req.destroy();no(Error('Body terlalu besar'))}});req.on('end',()=>ok(j(d,{})));req.on('error',no)})}
function limited(req,key,max){let ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0],k=key+ip,n=Date.now(),b=buckets.get(k)||{n:0,e:n+60000};if(n>b.e)b={n:0,e:n+60000};b.n++;buckets.set(k,b);return b.n<=max}
function token(req){let a=String(req.headers.authorization||'');return a.toLowerCase().startsWith('bearer ')?a.slice(7).trim():String(req.headers['x-admin-token']||'').trim()}
function tokenPayload(req){let t=token(req),x=t.split('.');if(x.length!==3||!['admin','owner'].includes(x[0]))return null;let s=crypto.createHmac('sha256',SESSION_SECRET).update(x[1]).digest('base64url');if(x[2].length!==s.length||!crypto.timingSafeEqual(Buffer.from(x[2]),Buffer.from(s)))return null;let p=j(Buffer.from(x[1],'base64url').toString(),{});return p.role===x[0]&&Number(p.exp)>Date.now()?p:null}
function admin(req){let t=token(req);if(ADMIN_API_TOKEN&&t===ADMIN_API_TOKEN)return true;let p=tokenPayload(req);return !!p&&['admin','owner'].includes(p.role)}
function owner(req){const p=tokenPayload(req);return !!p&&p.role==='owner'}
function session(role='admin'){let exp=Date.now()+43200000,p=Buffer.from(JSON.stringify({role,exp})).toString('base64url'),s=crypto.createHmac('sha256',SESSION_SECRET).update(p).digest('base64url');return{token:`${role}.${p}.${s}`,expiresAt:exp,role}}
function member(m){return{id:m.username,username:m.username,name:m.name,phone:m.phone,address:m.address||'',level:m.level||'MEMBER',active:!!m.active,joinedAt:m.joined_at||''}}
function product(p){return{id:Number(p.id),name:p.name,barcode:p.barcode||'',brand:p.brand,supplierName:p.supplier_name||'',category:p.category,sub:p.sub,bigUnit:p.big_unit,smallUnit:p.small_unit,contentPerBig:Number(p.content_per_big),stockSmall:Number(p.stock_small),cost:Number(p.cost),priceSmall:Number(p.price_small),priceBig:Number(p.price_big),priceMember1Small:Number(p.price_member1_small),priceMember1Big:Number(p.price_member1_big),priceMember2Small:Number(p.price_member2_small),priceMember2Big:Number(p.price_member2_big),thresholdSmall:Number(p.threshold_small),img:p.img||''}}
function pvals(p){return[Number(p.id),p.name||'',String(p.barcode||'').trim()||null,p.brand||'',p.category||'Umum',p.sub||'Umum',p.bigUnit||'karton',p.smallUnit||'pcs',+p.contentPerBig||1,+p.stockSmall||0,+p.cost||0,+p.priceSmall||0,+p.priceBig||0,+p.priceMember1Small||0,+p.priceMember1Big||0,+p.priceMember2Small||0,+p.priceMember2Big||0,Number(p.thresholdSmall??5),p.img||'',String(p.supplierName||'').trim()]}
function order(o,items){return{id:Number(o.id),date:o.date,memberName:o.member_name,memberPhone:o.member_phone,memberLevel:o.member_level,accountUsername:o.account_username||'',items:items.filter(i=>+i.order_id===+o.id).map(i=>({id:i.product_id,name:i.name,saleType:i.sale_type,displayQty:+i.display_qty,displayUnit:i.display_unit,displayPrice:+i.display_price,qtySmall:+i.qty_small,smallUnit:i.small_unit,priceSmall:+i.price_small,costSmall:+i.cost_small,subtotal:+i.subtotal,modal:+i.modal,profit:+i.profit})),total:+o.total,modal:+o.modal,profit:+o.profit,points:+o.points,prepared:!!o.prepared}}
async function setting(k,f){let r=await q('SELECT value_json FROM site_settings WHERE `key`=?',[k]);return r.length?j(r[0].value_json,f):f}
async function state(){let [ps,cs,ms,os,is,promos]=await Promise.all([q('SELECT * FROM products ORDER BY id'),q('SELECT * FROM categories ORDER BY name'),q('SELECT * FROM members ORDER BY username'),q('SELECT * FROM orders ORDER BY id DESC'),q('SELECT * FROM order_items ORDER BY id'),setting('promos',[])]);return{products:ps.map(product),categories:cs.map(x=>({name:x.name,subs:j(x.subs_json,[])})),members:ms.map(member),orders:os.map(x=>order(x,is)),promos:Array.isArray(promos)?promos:[]}}
async function publicState(){let[cs,promos]=await Promise.all([q('SELECT * FROM categories ORDER BY name'),setting('promos',[])]);return{products:[],categories:cs.map(x=>({name:x.name,subs:j(x.subs_json,[])})),promos:Array.isArray(promos)?promos:[]}}
async function publicProducts(req){let u=new URL(req.url,'http://x'),page=Math.max(1,parseInt(u.searchParams.get('page'))||1),limit=Math.min(100,Math.max(1,parseInt(u.searchParams.get('limit'))||60)),w=[],v=[],cat=u.searchParams.get('category')||'',brand=u.searchParams.get('brand')||'',barcode=(u.searchParams.get('barcode')||'').trim(),search=(u.searchParams.get('q')||'').trim();if(barcode){w.push('barcode=?');v.push(barcode)}if(cat&&cat!=='Semua'){if(cat==='Bahan Pokok'){w.push(`category IN (${ph(BAHAN)})`);v.push(...BAHAN)}else{w.push('category=?');v.push(cat)}}if(brand&&brand!=='Semua'){w.push('brand=?');v.push(brand)}if(search){w.push('(name LIKE ? OR brand LIKE ? OR category LIKE ? OR sub LIKE ? OR barcode LIKE ?)');v.push(...Array(5).fill('%'+search+'%'))}let where=w.length?' WHERE '+w.join(' AND '):'',total=+(await q('SELECT COUNT(*) total FROM products'+where,v))[0].total,rows=await q('SELECT * FROM products'+where+' ORDER BY id LIMIT ? OFFSET ?',[...v,limit,(page-1)*limit]);return{products:rows.map(x=>{let p=product(x);delete p.cost;delete p.supplierName;return p}),page,limit,total}}
async function publicCategories(){let[cs,ps]=await Promise.all([q('SELECT * FROM categories ORDER BY name'),q('SELECT DISTINCT category,brand FROM products')]);return{categories:cs.map(x=>({name:x.name,subs:j(x.subs_json,[])})),productCategories:['Semua',...new Set(ps.map(x=>x.category).filter(Boolean))],brands:['Semua',...new Set(ps.map(x=>x.brand).filter(Boolean))].sort((a,b)=>a==='Semua'?-1:b==='Semua'?1:a.localeCompare(b))}}
async function save(data){let c=await db().getConnection();try{await c.beginTransaction();let del=[...new Set((data.deletedProductIds||[]).map(Number).filter(Number.isFinite))];if(del.length)await c.execute(`DELETE FROM products WHERE id IN (${ph(del)})`,del);if(Array.isArray(data.products))for(let p of data.products)await c.execute('INSERT INTO products (id,name,barcode,brand,category,sub,big_unit,small_unit,content_per_big,stock_small,cost,price_small,price_big,price_member1_small,price_member1_big,price_member2_small,price_member2_big,threshold_small,img,supplier_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),barcode=VALUES(barcode),brand=VALUES(brand),category=VALUES(category),sub=VALUES(sub),big_unit=VALUES(big_unit),small_unit=VALUES(small_unit),content_per_big=VALUES(content_per_big),stock_small=VALUES(stock_small),cost=VALUES(cost),price_small=VALUES(price_small),price_big=VALUES(price_big),price_member1_small=VALUES(price_member1_small),price_member1_big=VALUES(price_member1_big),price_member2_small=VALUES(price_member2_small),price_member2_big=VALUES(price_member2_big),threshold_small=VALUES(threshold_small),img=VALUES(img),supplier_name=VALUES(supplier_name)',pvals(p));if(Array.isArray(data.categories))for(let x of data.categories)await c.execute('INSERT INTO categories (name,subs_json) VALUES (?,?) ON DUPLICATE KEY UPDATE subs_json=VALUES(subs_json)',[x.name,JSON.stringify(x.subs||['Umum'])]);let dm=(data.deletedMemberUsernames||[]).filter(Boolean);if(dm.length)await c.execute(`DELETE FROM members WHERE username IN (${ph(dm)})`,dm);if(Array.isArray(data.members))for(let x of data.members){let user=x.username||x.id||x.name;if(user)await c.execute('INSERT INTO members (username,name,phone,address,level,password,active,joined_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),phone=VALUES(phone),address=VALUES(address),level=VALUES(level),password=VALUES(password),active=VALUES(active),joined_at=VALUES(joined_at)',[user,x.name||'',x.phone||'',x.address||'',x.level||'MEMBER 3',x.password||'member123',x.active===false?0:1,x.joinedAt||''])}if(Array.isArray(data.promos))await c.execute('INSERT INTO site_settings (`key`,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)',['promos',JSON.stringify(data.promos)]);await c.commit()}catch(e){await c.rollback();throw e}finally{c.release()}return state()}
async function checkout(m,cart){if(!m)throw Error('Silakan login member dulu.');if(!Array.isArray(cart)||!cart.length)throw Error('Keranjang kosong.');let c=await db().getConnection();try{await c.beginTransaction();let agg=new Map();for(let x of cart){let id=+x.id,n=+x.displayQty;if(!id||n<=0)throw Error('Jumlah produk tidak valid.');agg.set(id,(agg.get(id)||0)+n*(x.saleType==='besar'?(+x.contentPerBig||1):1))}let ps=new Map();for(let[id,n]of agg){let[r]=await c.execute('SELECT * FROM products WHERE id=? FOR UPDATE',[id]);if(!r.length)throw Error('Produk sudah dihapus admin.');if(n>+r[0].stock_small)throw Error(`Stok ${r[0].name} tidak cukup.`);ps.set(id,r[0])}let user=m.username||m.accountUsername||m.phone||m.name;await c.execute('INSERT INTO members (username,name,phone,address,level,password,active,joined_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),phone=VALUES(phone),address=IF(VALUES(address)<>\'\',VALUES(address),address),level=VALUES(level)',[user,m.name||'',m.phone||'',m.address||'',m.level||'MEMBER 3','member123',1,m.joinedAt||new Date().toLocaleString('id-ID')]);let[r]=await c.execute('INSERT INTO orders (date,member_name,member_phone,member_level,account_username) VALUES (?,?,?,?,?)',[new Date().toLocaleString('id-ID'),m.name||'',m.phone||'',m.level||'MEMBER 3',user]),oid=r.insertId,total=0,modal=0,items=[];for(let x of cart){let p=ps.get(+x.id),big=x.saleType==='besar',dq=+x.displayQty,qs=dq*(big?+p.content_per_big:1),price=big?(m.level==='MEMBER 1'&&+p.price_member1_big>0?+p.price_member1_big:m.level==='MEMBER 2'&&+p.price_member2_big>0?+p.price_member2_big:+p.price_big):(m.level==='MEMBER 1'&&+p.price_member1_small>0?+p.price_member1_small:m.level==='MEMBER 2'&&+p.price_member2_small>0?+p.price_member2_small:+p.price_small),sub=price*dq,mo=+p.cost*qs;await c.execute('UPDATE products SET stock_small=stock_small-? WHERE id=?',[qs,p.id]);await c.execute('INSERT INTO order_items (order_id,product_id,name,sale_type,display_qty,display_unit,display_price,qty_small,small_unit,price_small,cost_small,subtotal,modal,profit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[oid,p.id,p.name,big?'besar':'kecil',dq,big?p.big_unit:p.small_unit,price,qs,p.small_unit,p.price_small,p.cost,sub,mo,sub-mo]);total+=sub;modal+=mo;items.push({id:p.id,name:p.name,saleType:big?'besar':'kecil',displayQty:dq,displayUnit:big?p.big_unit:p.small_unit,displayPrice:price,qtySmall:qs,smallUnit:p.small_unit,priceSmall:+p.price_small,costSmall:+p.cost,subtotal:sub,modal:mo,profit:sub-mo})}let profit=total-modal,points=Math.floor(total/100000);await c.execute('UPDATE orders SET total=?,modal=?,profit=?,points=? WHERE id=?',[total,modal,profit,points,oid]);await c.commit();return{id:oid,date:new Date().toLocaleString('id-ID'),memberName:m.name||'',memberPhone:m.phone||'',memberLevel:m.level||'MEMBER 3',accountUsername:user,items,total,modal,profit,points,prepared:false}}catch(e){await c.rollback();throw e}finally{c.release()}}
async function updateProductStock(req,res,id,action){
  if(!admin(req))return send(res,401,{ok:false,error:'Akses admin ditolak.'});
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  const b=await body(req),c=await db().getConnection();
  const number=(v,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error(`${label} tidak valid.`);return n};
  try{
    await c.beginTransaction();
    const [found]=await c.execute('SELECT * FROM products WHERE id=? FOR UPDATE',[id]);
    if(!found.length){await c.rollback();return send(res,404,{ok:false,error:'Produk tidak ditemukan.'})}
    if(action==='receive'){
      const qty=number(b.quantity,'Jumlah stok');if(qty<=0)throw Error('Jumlah stok masuk harus lebih dari 0.');
      const supplier=String(b.supplierName||'').trim()||String(found[0].supplier_name||'');
      await c.execute('UPDATE products SET stock_small=stock_small+?,supplier_name=? WHERE id=?',[qty,supplier,id]);
    }else if(action==='details'){
      const supplier=String(b.supplierName||'').trim();
      const cost=number(b.cost,'Harga pokok'),priceSmall=number(b.priceSmall,'Harga jual kecil'),priceBig=number(b.priceBig,'Harga jual besar');
      const m1s=number(b.priceMember1Small,'Harga Member 1 kecil'),m1b=number(b.priceMember1Big,'Harga Member 1 besar'),m2s=number(b.priceMember2Small,'Harga Member 2 kecil'),m2b=number(b.priceMember2Big,'Harga Member 2 besar');
      await c.execute('UPDATE products SET supplier_name=?,cost=?,price_small=?,price_big=?,price_member1_small=?,price_member1_big=?,price_member2_small=?,price_member2_big=? WHERE id=?',[supplier,cost,priceSmall,priceBig,m1s,m1b,m2s,m2b,id]);
    }else{await c.rollback();return send(res,404,{ok:false,error:'Aksi tidak ditemukan.'})}
    const [updated]=await c.execute('SELECT * FROM products WHERE id=?',[id]);await c.commit();return send(res,200,{ok:true,product:product(updated[0])});
  }catch(e){await c.rollback();return send(res,400,{ok:false,error:e.message})}finally{c.release()}
}
async function listPurchaseReceipts(req,res){
  if(!admin(req))return send(res,401,{ok:false,error:'Akses admin ditolak.'});
  const u=new URL(req.url,'http://localhost'),unpaid=u.searchParams.get('unpaid')==='1',date=u.searchParams.get('date')||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
  if(!unpaid&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,{ok:false,error:'Tanggal tidak valid.'});
  const receipts=unpaid
    ?await q("SELECT id,receipt_date,invoice_number,supplier_name,total,paid_amount,due_date,payment_status,created_at FROM purchase_receipts WHERE payment_status IN ('UNPAID','PARTIAL') AND paid_amount<total ORDER BY due_date IS NULL,due_date,id DESC")
    :await q('SELECT id,receipt_date,invoice_number,supplier_name,total,paid_amount,due_date,payment_status,created_at FROM purchase_receipts WHERE receipt_date=? ORDER BY id DESC',[date]);
  if(!receipts.length)return send(res,200,{ok:true,receipts:[]});
  const ids=receipts.map(x=>x.id),[items,payments]=await Promise.all([q(`SELECT * FROM purchase_receipt_items WHERE receipt_id IN (${ph(ids)}) ORDER BY id`,ids),q(`SELECT * FROM purchase_receipt_payments WHERE receipt_id IN (${ph(ids)}) ORDER BY paid_at,id`,ids)]),byReceipt=new Map(),byPayment=new Map();
  for(const x of items){if(!byReceipt.has(Number(x.receipt_id)))byReceipt.set(Number(x.receipt_id),[]);byReceipt.get(Number(x.receipt_id)).push({productId:Number(x.product_id),productName:x.product_name,quantity:Number(x.quantity),unit:x.unit,unitCost:Number(x.unit_cost),lineTotal:Number(x.line_total)})}
  for(const x of payments){if(!byPayment.has(Number(x.receipt_id)))byPayment.set(Number(x.receipt_id),[]);byPayment.get(Number(x.receipt_id)).push({amount:Number(x.amount),method:x.payment_method||'',paidAt:x.paid_at,note:x.note||''})}
  return send(res,200,{ok:true,receipts:receipts.map(x=>({id:Number(x.id),date:sqlDate(x.receipt_date),invoiceNumber:x.invoice_number||'',supplierName:x.supplier_name,total:Number(x.total),amountPaid:Number(x.paid_amount||0),outstanding:Number(x.total)-Number(x.paid_amount||0),dueDate:x.due_date?sqlDate(x.due_date):'',paymentStatus:x.payment_status||'UNKNOWN',createdAt:x.created_at,items:byReceipt.get(Number(x.id))||[],payments:byPayment.get(Number(x.id))||[]}))});
}
async function createPurchaseReceipt(req,res){
  if(!admin(req))return send(res,401,{ok:false,error:'Akses admin ditolak.'});
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  const b=await body(req),date=String(b.date||''),supplier=String(b.supplierName||'').trim(),invoice=String(b.invoiceNumber||'').trim(),lines=Array.isArray(b.items)?b.items:[],amountPaid=Number(b.amountPaid||0),dueDate=String(b.dueDate||''),paymentMethod=String(b.paymentMethod||'Tunai').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,{ok:false,error:'Tanggal nota tidak valid.'});
  if(!supplier)return send(res,400,{ok:false,error:'Nama supplier wajib diisi.'});
  if(!lines.length)return send(res,400,{ok:false,error:'Tambahkan minimal satu barang ke nota.'});
  const c=await db().getConnection(),updated=new Map();let receiptId,total=0;
  try{
    await c.beginTransaction();const ready=[];
    for(const line of lines){
      const productId=Number(line.productId),quantity=Number(line.quantity),unitCost=Number(line.unitCost||0);
      if(!Number.isInteger(productId)||productId<=0||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitCost)||unitCost<0)throw Error('Periksa barang, jumlah, dan modal pada semua baris nota.');
      const [found]=await c.execute('SELECT * FROM products WHERE id=? FOR UPDATE',[productId]);if(!found.length)throw Error(`Barang dengan ID ${productId} tidak ditemukan.`);
      const p=found[0],lineTotal=Number((quantity*unitCost).toFixed(2));total+=lineTotal;ready.push({product:p,productId,quantity,unitCost,lineTotal});
      await c.execute('UPDATE products SET stock_small=stock_small+?,supplier_name=?,cost=? WHERE id=?',[quantity,supplier,unitCost,productId]);
      const [after]=await c.execute('SELECT * FROM products WHERE id=?',[productId]);updated.set(productId,product(after[0]));
    }
    if(!Number.isFinite(amountPaid)||amountPaid<0||amountPaid>total)throw Error('Jumlah pembayaran harus antara Rp0 dan total nota.');
    const outstanding=Number((total-amountPaid).toFixed(2)),paymentStatus=outstanding<=0?'PAID':amountPaid>0?'PARTIAL':'UNPAID';
    if(outstanding>0&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw Error('Tanggal jatuh tempo wajib diisi untuk nota yang belum lunas.');
    const [header]=await c.execute('INSERT INTO purchase_receipts (receipt_date,invoice_number,supplier_name,total,paid_amount,due_date,payment_status) VALUES (?,?,?,?,?,?,?)',[date,invoice,supplier,total,amountPaid,dueDate||null,paymentStatus]);receiptId=header.insertId;
    for(const line of ready)await c.execute('INSERT INTO purchase_receipt_items (receipt_id,product_id,product_name,quantity,unit,unit_cost,line_total) VALUES (?,?,?,?,?,?,?)',[receiptId,line.productId,line.product.name,line.quantity,line.product.small_unit,line.unitCost,line.lineTotal]);
    if(amountPaid>0)await c.execute('INSERT INTO purchase_receipt_payments (receipt_id,amount,payment_method,note) VALUES (?,?,?,?)',[receiptId,amountPaid,paymentMethod,'Pembayaran saat nota diterima']);
    await c.commit();
    return send(res,201,{ok:true,receipt:{id:Number(receiptId),date,invoiceNumber:invoice,supplierName:supplier,total,amountPaid,outstanding,dueDate,paymentStatus,items:ready.map(x=>({productId:x.productId,productName:x.product.name,quantity:x.quantity,unit:x.product.small_unit,unitCost:x.unitCost,lineTotal:x.lineTotal}))},products:[...updated.values()]});
  }catch(e){await c.rollback();return send(res,400,{ok:false,error:e.message})}finally{c.release()}
}
async function recordPurchasePayment(req,res,receiptId){
  if(!admin(req))return send(res,401,{ok:false,error:'Akses admin ditolak.'});
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  const b=await body(req),amount=Number(b.amount),method=String(b.paymentMethod||'Tunai').trim();
  if(!Number.isFinite(amount)||amount<=0)return send(res,400,{ok:false,error:'Masukkan jumlah pembayaran lebih dari Rp0.'});
  const c=await db().getConnection();
  try{
    await c.beginTransaction();const [rows]=await c.execute('SELECT * FROM purchase_receipts WHERE id=? FOR UPDATE',[receiptId]);if(!rows.length){await c.rollback();return send(res,404,{ok:false,error:'Nota tidak ditemukan.'})}
    const receipt=rows[0],oldPaid=Number(receipt.paid_amount||0),total=Number(receipt.total),outstanding=Number((total-oldPaid).toFixed(2));if(amount>outstanding){await c.rollback();return send(res,400,{ok:false,error:`Pembayaran melebihi sisa utang ${outstanding}.`})}
    const newPaid=Number((oldPaid+amount).toFixed(2)),newOutstanding=Number((total-newPaid).toFixed(2)),status=newOutstanding<=0?'PAID':'PARTIAL';
    await c.execute('INSERT INTO purchase_receipt_payments (receipt_id,amount,payment_method,note) VALUES (?,?,?,?)',[receiptId,amount,method,'Pembayaran utang supplier']);
    await c.execute('UPDATE purchase_receipts SET paid_amount=?,payment_status=? WHERE id=?',[newPaid,status,receiptId]);
    await c.commit();return send(res,200,{ok:true,receipt:{id:receiptId,total,amountPaid:newPaid,outstanding:newOutstanding,paymentStatus:status}});
  }catch(e){await c.rollback();return send(res,400,{ok:false,error:e.message})}finally{c.release()}
}
async function api(req,res){const paymentRoute=req.url.match(/^\/api\/purchase-receipts\/(\d+)\/payments(?:\?|$)/);if(paymentRoute)return recordPurchasePayment(req,res,Number(paymentRoute[1]));if(req.url.startsWith('/api/purchase-receipts'))return req.method==='GET'?listPurchaseReceipts(req,res):createPurchaseReceipt(req,res);const stockRoute=req.url.match(/^\/api\/product-stock\/(\d+)\/(receive|details)$/);if(stockRoute)return updateProductStock(req,res,Number(stockRoute[1]),stockRoute[2]);if(req.method==='GET'&&req.url==='/api/public-state')return send(res,200,await publicState());if(req.method==='GET'&&req.url.startsWith('/api/products'))return send(res,200,await publicProducts(req));if(req.method==='GET'&&req.url==='/api/categories')return send(res,200,await publicCategories());if(req.method==='POST'&&req.url==='/api/member-login'){if(!limited(req,'member',20))return send(res,429,{ok:false,error:'Terlalu banyak percobaan login.'});let b=await body(req),r=await q('SELECT * FROM members WHERE username=? LIMIT 1',[String(b.username||'').trim()]),m=r[0];if(!m||m.password!==String(b.password||''))return send(res,401,{ok:false,error:'Username atau password member salah.'});if(!m.active)return send(res,403,{ok:false,error:'Akun member ini sedang nonaktif.'});return send(res,200,{ok:true,member:member(m)})}if(req.method==='POST'&&req.url==='/api/admin-login'){if(!limited(req,'admin',10))return send(res,429,{ok:false,error:'Terlalu banyak percobaan login.'});let b=await body(req);return b.username===ADMIN_USERNAME&&b.password===ADMIN_PASSWORD?send(res,200,{ok:true,...session('admin')}):send(res,401,{ok:false,error:'Login salah'})}if(req.method==='POST'&&req.url==='/api/owner-login'){if(!limited(req,'owner',5))return send(res,429,{ok:false,error:'Terlalu banyak percobaan password pemilik.'});if(OWNER_PASSWORD.length<8)return send(res,503,{ok:false,error:'Akses pemilik belum dikonfigurasi. Atur OWNER_PASSWORD (minimal 8 karakter) di server.'});let b=await body(req);return String(b.password||'')===OWNER_PASSWORD?send(res,200,{ok:true,...session('owner')}):send(res,401,{ok:false,error:'Password pemilik salah.'})}if(req.url==='/api/owner-summary'){if(!owner(req))return send(res,403,{ok:false,error:'Ringkasan ini hanya untuk pemilik.'});let[[sales],[stock],[products],[members]] = await Promise.all([q('SELECT COUNT(*) count,COALESCE(SUM(total),0) revenue,COALESCE(SUM(modal),0) modal,COALESCE(SUM(profit),0) profit FROM orders'),q('SELECT COALESCE(SUM(stock_small*cost),0) value FROM products'),q('SELECT COUNT(*) count FROM products'),q('SELECT COUNT(*) count FROM members')]);return send(res,200,{ok:true,summary:{orders:Number(sales.count),revenue:Number(sales.revenue),modal:Number(sales.modal),profit:Number(sales.profit),stockValue:Number(stock.value),products:Number(products.count),members:Number(members.count)}})}if(req.url==='/api/state'){if(!admin(req))return send(res,401,{ok:false,error:'Akses admin ditolak.'});return req.method==='GET'?send(res,200,await state()):req.method==='POST'?send(res,200,{ok:true,state:await save(await body(req))}):send(res,405,{ok:false,error:'Method tidak diizinkan'})}if(req.method==='POST'&&req.url==='/api/checkout'){if(!limited(req,'checkout',30))return send(res,429,{ok:false,error:'Terlalu banyak checkout.'});let b=await body(req);try{return send(res,200,{ok:true,order:await checkout(b.member,b.cart),state:await state()})}catch(e){return send(res,409,{ok:false,error:e.message})}}return send(res,404,{ok:false,error:'API tidak ditemukan'})}
function staticFile(req,res){let u=decodeURIComponent(req.url.split('?')[0]),f=path.resolve(ROOT,'.'+(u==='/'?'/index.html':u));if(!f.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d)})}
function appHandler(req,res){if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':process.env.ALLOWED_ORIGIN||'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Admin-Token, Authorization'});return res.end()}if(req.url==='/health'||req.url==='/api/health')return send(res,200,{ok:true,app:'JSA MySQL Hostinger',mysqlConfigured:!!(process.env.DB_HOST&&process.env.DB_NAME&&process.env.DB_USER&&process.env.DB_PASSWORD)});if(req.url.startsWith('/api/'))return api(req,res).catch(e=>send(res,500,{ok:false,error:e.message}));return staticFile(req,res)}
if(require.main===module){let s=http.createServer(appHandler);s.on('error',e=>{console.error(e);process.exit(1)});s.listen(PORT,HOST,()=>console.log(`JSA MySQL berjalan di ${HOST}:${PORT}`))}

// Mempertahankan riwayat order ketika Admin mengimpor backup JSON.
// Pemisahan ini juga membuat data baru tidak disentuh bila patch tidak berisi orders.
const saveWithoutOrders=save;
save=async function(data){
  const saved=await saveWithoutOrders(data);
  if(!Array.isArray(data.orders))return saved;
  const c=await db().getConnection();
  try{
    await c.beginTransaction();
    await c.execute('DELETE FROM order_items');
    await c.execute('DELETE FROM orders');
    for(const o of data.orders){
      await c.execute('INSERT INTO orders (id,date,member_name,member_phone,member_level,account_username,total,modal,profit,points,prepared) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[Number(o.id),o.date||'',o.memberName||'',o.memberPhone||'',o.memberLevel||'',o.accountUsername||'',Number(o.total)||0,Number(o.modal)||0,Number(o.profit)||0,Number(o.points)||0,o.prepared?1:0]);
      for(const i of (o.items||[]))await c.execute('INSERT INTO order_items (order_id,product_id,name,sale_type,display_qty,display_unit,display_price,qty_small,small_unit,price_small,cost_small,subtotal,modal,profit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[Number(o.id),i.id?Number(i.id):null,i.name||'',i.saleType||'',Number(i.displayQty||i.qty)||0,i.displayUnit||i.smallUnit||'',Number(i.displayPrice||i.price)||0,Number(i.qtySmall||i.qty)||0,i.smallUnit||'',Number(i.priceSmall)||0,Number(i.costSmall)||0,Number(i.subtotal)||0,Number(i.modal)||0,Number(i.profit)||0]);
    }
    await c.commit();
  }catch(e){await c.rollback();throw e}finally{c.release()}
  return state();
};
module.exports={appHandler,api,send};

// Respons checkout sengaja ringkas. Versi awal turut mengirim seluruh state
// (semua produk, member, dan order) ke setiap pembeli, yang boros bandwidth.
const apiBeforeSlimCheckout = api;
api = async function(req, res) {
  if (req.method === 'POST' && req.url === '/api/checkout') {
    if (!limited(req, 'checkout', 30)) return send(res, 429, { ok:false, error:'Terlalu banyak checkout.' });
    const requestBody = await body(req);
    try {
      const order = await checkout(requestBody.member, requestBody.cart);
      return send(res, 200, { ok:true, order });
    } catch (err) {
      return send(res, 409, { ok:false, error:err.message });
    }
  }
  return apiBeforeSlimCheckout(req, res);
};
module.exports={appHandler,api,send};
