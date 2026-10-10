// The application uses this contract; adapters own runtime-specific wire formats.
const required=['status','models','chat','pull','remove'];
export class RuntimeRegistry {
 constructor(){this.adapters=new Map()}
 register(id,adapter){if(!/^[a-z][a-z0-9-]*$/.test(id)||required.some(method=>typeof adapter?.[method]!=='function'))throw Error('Adaptador local inválido.');this.adapters.set(id,adapter);return this}
 get(id){const adapter=this.adapters.get(id);if(!adapter)throw Error('Provider local indisponível.');return adapter}
 list(){return [...this.adapters.keys()].map(id=>({id,kind:'local'}))}
}
