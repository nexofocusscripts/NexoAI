#include <windows.h>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>
namespace fs=std::filesystem;
static std::wstring quote(const std::wstring& text){std::wstring out=L"\"";unsigned slashes=0;for(wchar_t c:text){if(c==L'\\'){slashes++;continue;}if(c==L'\"'){out.append(slashes*2+1,L'\\');out+=c;}else{out.append(slashes,L'\\');out+=c;}slashes=0;}out.append(slashes*2,L'\\');return out+L"\"";}
static DWORD run(const fs::path& executable,std::wstring args,bool wait){std::wstring command=quote(executable.wstring())+L" "+args;STARTUPINFOW startup{};startup.cb=sizeof(startup);PROCESS_INFORMATION process{};if(!CreateProcessW(executable.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_NO_WINDOW,nullptr,executable.parent_path().c_str(),&startup,&process))throw std::runtime_error("Nao foi possivel iniciar o instalador");CloseHandle(process.hThread);DWORD code=0;if(wait){if(WaitForSingleObject(process.hProcess,600000)!=WAIT_OBJECT_0){CloseHandle(process.hProcess);throw std::runtime_error("Tempo limite de instalacao");}GetExitCodeProcess(process.hProcess,&code);}CloseHandle(process.hProcess);return code;}
static void copyTree(const fs::path& from,const fs::path& to){fs::create_directories(to);for(const auto& entry:fs::recursive_directory_iterator(from)){if(entry.is_symlink())throw std::runtime_error("Ligacao simbolica no pacote");const auto destination=to/fs::relative(entry.path(),from);if(entry.is_directory())fs::create_directories(destination);else if(entry.is_regular_file()){fs::create_directories(destination.parent_path());fs::copy_file(entry.path(),destination,fs::copy_options::overwrite_existing);}}}
static void restoreTree(const fs::path& from,const fs::path& app,const std::wstring& exe){if(!fs::is_regular_file(from/exe))throw std::runtime_error("Recuperacao incompleta");for(const auto& entry:fs::recursive_directory_iterator(from))if(entry.is_symlink())throw std::runtime_error("Ligacao simbolica na recuperacao");for(unsigned retry=0;;retry++){std::error_code error;fs::remove_all(app,error);if(!error)break;if(retry>=149){copyTree(from,app);throw std::runtime_error("A recuperacao aguarda ficheiros ainda abertos. A instalacao anterior foi preservada; fecha a aplicacao e tenta novamente.");}Sleep(200);}copyTree(from,app);}
static bool within(const fs::path& child,const fs::path& parent){const auto relative=child.lexically_relative(parent);return !relative.empty()&&*relative.begin()!=L"..";}
int wmain(int argc,wchar_t** argv){
 if(argc!=8)return 2;
 const std::wstring mode=argv[1];const DWORD parent=wcstoul(argv[2],nullptr,10);const fs::path app=fs::absolute(argv[3]).lexically_normal(),stage=fs::absolute(argv[4]).lexically_normal(),rollback=fs::absolute(argv[5]).lexically_normal();const std::wstring exe=argv[6],version=argv[7];
 if((mode!=L"install"&&mode!=L"rollback")||!parent||rollback.filename()!=L"rollback"||exe.find_first_of(L"\\/:")!=std::wstring::npos||within(rollback,app)||within(stage,app)||within(app,rollback))return 3;
 try{
  HANDLE process=OpenProcess(SYNCHRONIZE,FALSE,parent);if(process){const DWORD result=WaitForSingleObject(process,120000);CloseHandle(process);if(result!=WAIT_OBJECT_0)throw std::runtime_error("A aplicacao nao terminou");}
  if(mode==L"install"){
   if(stage.parent_path().parent_path()!=rollback.parent_path())throw std::runtime_error("Pasta de atualizacao invalida");
   fs::remove_all(rollback/L"app");copyTree(app,rollback/L"app");std::ofstream(rollback/L"version.txt")<<std::string(version.begin(),version.end());
   const DWORD code=run(stage/L"setup.exe",L"/S /D="+app.wstring(),true);if(code!=0){restoreTree(rollback/L"app",app,exe);throw std::runtime_error("Instalacao falhou; ficheiros anteriores recuperados");}
  }else{if(stage!=rollback)throw std::runtime_error("Recuperacao invalida");restoreTree(rollback/L"app",app,exe);}
  std::ofstream(rollback.parent_path()/L"result.txt")<<"completed";
  run(app/exe,L"",false);return 0;
 }catch(const std::exception& error){std::ofstream(rollback.parent_path()/L"result.txt")<<error.what();try{run(app/exe,L"",false);}catch(...){}return 1;}
}
