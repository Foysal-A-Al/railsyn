// Modeled part families; these are simulation dimensions, not measured tolerances.
export function createInventory(){
 const list=[];
 for(let i=0;i<4;i++)list.push({id:'B'+(i+1),kind:'body',name:(i%2?'Steel':'Graphite')+' cup / fixture',family:i%2?'B':'A',color:i%2?'#758188':'#222b32',quantity:1,height:.11,position:[-5.35+(i%2)*.48,1.4,.05-Math.floor(i/2)*.48]});
 for(const kind of ['cap','top'])for(let i=0;i<9;i++)list.push({id:(kind==='cap'?'C':'T')+(i+1),kind,name:(kind==='cap'?'Lower cap':'Top cover')+' / '+['graphite','nickel','ivory'][i%3],family:i%2?'B':'A',color:['#26323c','#7f8c94','#d5d6cf'][i%3],quantity:kind==='top'?2:1,height:kind==='top'?.055:.08,position:kind==='cap'?[-.8+(i%3)*.28,1.4,4.25+Math.floor(i/3)*.28]:[5.3+(i%3)*.32,1.4,.05-Math.floor(i/3)*.32]});
 return list;
}
export function pickupPoint(p){return [p.position[0],p.position[1]+(p.quantity-1)*p.height,p.position[2]];}
export function initialRecipe(inventory){return {body:inventory.find(p=>p.kind==='body').id,cap:inventory.find(p=>p.kind==='cap').id,top:inventory.find(p=>p.kind==='top').id,destination:'collect'};}
export function validateRecipe(inventory,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['body','cap','top','count','destination'].includes(k)))throw Error('Invalid recipe fields.');
 const parts=['body','cap','top'].map(kind=>{const p=inventory.find(p=>p.id===value[kind]&&p.kind===kind);if(!p)throw Error('Unknown '+kind+' pocket.');if(p.quantity<1)throw Error(p.id+' is empty / exhausted.');return p;});
 if(!['collect','hold'].includes(value.destination)||value.count!==1)throw Error('Each Run executes one selected assembly; choose a valid destination.');return parts;
}
