import test from 'node:test';import assert from 'node:assert/strict';import {webSearchService} from '../src/modules/web-search.mjs';import {imageService} from '../src/modules/images.mjs';import {checkUpdate} from '../src/modules/updater.mjs';import {embeddingService} from '../src/modules/embeddings.mjs';
test('web search respects offline mode',async()=>{await assert.rejects(()=>webSearchService({onlineMode:false,webSearch:false}).search('x'),/desativada/)});
test('local image status is explicit',()=>{assert.equal(imageService({localImage:{enabled:true,baseUrl:'http://127.0.0.1:7860'}}).status().enabled,true)});
test('updater can be unconfigured',async()=>{assert.deepEqual(await checkUpdate({updates:{}},'1.0.0'),{configured:false,current:'1.0.0'})});
test('cosine similarity works',()=>{assert.equal(embeddingService().cosine([1,0],[1,0]),1)});

test('local image engine rejects remote destinations',()=>{assert.throws(()=>imageService({localImage:{enabled:true,baseUrl:'https://example.com'}}).status(),/loopback/)});
