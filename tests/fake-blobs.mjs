// Nur für automatisierte lokale Schnittstellentests. Nicht in der öffentlichen Website benutzt.
const stores=new Map();
export function resetStores(){stores.clear();}
export function getStore(opts){
 const name=typeof opts==='string'?opts:opts.name;
 if(!stores.has(name))stores.set(name,new Map());
 const data=stores.get(name);
 return {
  async get(key){const ent=data.get(key);return ent?structuredClone(ent.value):null;},
  async getWithMetadata(key){const ent=data.get(key);return ent?{data:structuredClone(ent.value),etag:ent.etag,metadata:{}}:null;},
  async setJSON(key,value,options={}){
   const ent=data.get(key);
   if((options.onlyIfNew&&ent)||(options.onlyIfMatch&&ent?.etag!==options.onlyIfMatch))return {modified:false};
   const etag=`"${(ent?.rev||0)+1}"`;
   data.set(key,{value:structuredClone(value),rev:(ent?.rev||0)+1,etag});return {modified:true,etag};
  },
  async delete(key){data.delete(key);},
  async list({prefix}={}){return {blobs:[...data.keys()].filter(k=>!prefix||k.startsWith(prefix)).map(key=>({key})),directories:[]};}
 };
}
