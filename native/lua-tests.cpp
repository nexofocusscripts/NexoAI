#include <cstdio>
extern "C" {
#include "vendor/lua-5.4.9/src/lua.h"
#include "vendor/lua-5.4.9/src/lauxlib.h"
#include "vendor/lua-5.4.9/src/lualib.h"
}
struct Results {int tests=0;int failed=0;};
static int test(lua_State* L){
 auto* results=static_cast<Results*>(lua_touserdata(L,lua_upvalueindex(1)));
 const char* name=luaL_checkstring(L,1);luaL_checktype(L,2,LUA_TFUNCTION);
 results->tests++;lua_pushvalue(L,2);
 if(lua_pcall(L,0,0,0)!=LUA_OK){results->failed++;std::fprintf(stderr,"FAIL %s: %s\n",name,lua_tostring(L,-1));lua_pop(L,1);}else std::fprintf(stderr,"PASS %s\n",name);
 return 0;
}
int main(int argc,char** argv){
 if(argc!=2)return 125;
 auto* L=luaL_newstate();if(!L)return 125;luaL_openlibs(L);Results results;
 lua_pushlightuserdata(L,&results);lua_pushcclosure(L,test,1);lua_setglobal(L,"test");
 const bool loaded=luaL_loadfile(L,argv[1])==LUA_OK;
 const bool ran=loaded&&lua_pcall(L,0,0,0)==LUA_OK;
 if(!ran)std::fprintf(stderr,"Lua: %s\n",lua_tostring(L,-1));
 std::fprintf(stderr,"NEXO_LUA_TESTS=%d FAILED=%d\n",results.tests,results.failed);
 lua_close(L);return ran&&results.tests>0&&results.failed==0?0:1;
}
