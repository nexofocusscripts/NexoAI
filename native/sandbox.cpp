#define UNICODE
#define _UNICODE
#include <windows.h>
#include <userenv.h>
#include <aclapi.h>
#include <sddl.h>
#include <string>
#include <vector>
#include <iostream>
#include <filesystem>
#include <algorithm>
#pragma comment(lib,"userenv.lib")
#pragma comment(lib,"advapi32.lib")

struct Grant {
 std::wstring path; PSECURITY_DESCRIPTOR descriptor=nullptr; PACL original=nullptr; PSID grantedSid=nullptr;bool granted=false;
 struct AclLock {HANDLE handle=CreateMutexW(nullptr,FALSE,L"Local\\NexoAI.SandboxAcl");bool acquired=false;AclLock(){if(handle){const auto r=WaitForSingleObject(handle,30000);acquired=r==WAIT_OBJECT_0||r==WAIT_ABANDONED;}}~AclLock(){if(acquired)ReleaseMutex(handle);if(handle)CloseHandle(handle);}};
 bool apply(const std::wstring& target,PSID sid,DWORD access) {
  AclLock lock;if(!lock.acquired)return false;grantedSid=sid;
  path=target;
  if(GetNamedSecurityInfoW(path.data(),SE_FILE_OBJECT,DACL_SECURITY_INFORMATION,nullptr,nullptr,&original,nullptr,&descriptor)!=ERROR_SUCCESS)return false;
  EXPLICIT_ACCESSW entry{};entry.grfAccessPermissions=access;entry.grfAccessMode=GRANT_ACCESS;entry.grfInheritance=SUB_CONTAINERS_AND_OBJECTS_INHERIT;
  entry.Trustee.TrusteeForm=TRUSTEE_IS_SID;entry.Trustee.TrusteeType=TRUSTEE_IS_UNKNOWN;entry.Trustee.ptstrName=static_cast<LPWSTR>(sid);
  PACL updated=nullptr;if(SetEntriesInAclW(1,&entry,original,&updated)!=ERROR_SUCCESS)return false;
  const auto result=SetNamedSecurityInfoW(path.data(),SE_FILE_OBJECT,DACL_SECURITY_INFORMATION,nullptr,nullptr,updated,nullptr);LocalFree(updated);granted=result==ERROR_SUCCESS;return granted;
 }
 ~Grant(){
  if(granted){AclLock lock;PSECURITY_DESCRIPTOR current=nullptr;PACL acl=nullptr,updated=nullptr;
   if(lock.acquired&&GetNamedSecurityInfoW(path.data(),SE_FILE_OBJECT,DACL_SECURITY_INFORMATION,nullptr,nullptr,&acl,nullptr,&current)==ERROR_SUCCESS){EXPLICIT_ACCESSW entry{};entry.grfAccessMode=REVOKE_ACCESS;entry.Trustee.TrusteeForm=TRUSTEE_IS_SID;entry.Trustee.ptstrName=static_cast<LPWSTR>(grantedSid);if(SetEntriesInAclW(1,&entry,acl,&updated)==ERROR_SUCCESS){SetNamedSecurityInfoW(path.data(),SE_FILE_OBJECT,DACL_SECURITY_INFORMATION,nullptr,nullptr,updated,nullptr);LocalFree(updated);}LocalFree(current);}
  }
  if(descriptor)LocalFree(descriptor);
 }
};
std::wstring quoted(const std::wstring& input){
 std::wstring result=L"\"";size_t slashes=0;
 for(wchar_t c:input){if(c==L'\\'){slashes++;continue;}if(c==L'\"')result.append(slashes*2+1,L'\\');else result.append(slashes,L'\\');slashes=0;result+=c;}
 result.append(slashes*2,L'\\');return result+L"\"";
}
int failure(const char* stage){std::cerr<<"Sandbox indisponível: "<<stage<<" (Windows "<<GetLastError()<<")\n";return 125;}
int wmain(int argc,wchar_t** argv){
 if(argc<5)return failure("argumentos");
 const std::wstring project=std::filesystem::absolute(argv[1]).wstring(),node=std::filesystem::absolute(argv[2]).wstring(),profile=argv[3];
 if(profile.find(L"NexoAI.Test.")!=0)return failure("perfil");
 PSID sid=nullptr;const HRESULT hr=CreateAppContainerProfile(profile.c_str(),L"Nexo AI testes",L"Testes locais isolados, sem rede",nullptr,0,&sid);
 if(FAILED(hr))return failure("AppContainer");
 int result=125;
 {
  Grant projectGrant,runtimeGrant;
  if(projectGrant.apply(project,sid,FILE_ALL_ACCESS)&&runtimeGrant.apply(std::filesystem::path(node).parent_path().wstring(),sid,FILE_GENERIC_READ|FILE_GENERIC_EXECUTE)){
   SECURITY_CAPABILITIES security{};security.AppContainerSid=sid;
   SIZE_T bytes=0;InitializeProcThreadAttributeList(nullptr,2,0,&bytes);
   std::vector<BYTE> buffer(bytes);auto attributes=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(buffer.data());
   if(InitializeProcThreadAttributeList(attributes,2,0,&bytes)){
    HANDLE stdoutHandle=nullptr,stderrHandle=nullptr;
    SECURITY_ATTRIBUTES sa{sizeof(sa),nullptr,TRUE};HANDLE input=CreateFileW(L"NUL",GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE,&sa,OPEN_EXISTING,0,nullptr);
    DuplicateHandle(GetCurrentProcess(),GetStdHandle(STD_OUTPUT_HANDLE),GetCurrentProcess(),&stdoutHandle,0,TRUE,DUPLICATE_SAME_ACCESS);
    DuplicateHandle(GetCurrentProcess(),GetStdHandle(STD_ERROR_HANDLE),GetCurrentProcess(),&stderrHandle,0,TRUE,DUPLICATE_SAME_ACCESS);
    HANDLE handles[]={input,stdoutHandle,stderrHandle};
    bool attributesOk=UpdateProcThreadAttribute(attributes,0,PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,&security,sizeof(security),nullptr,nullptr)&&UpdateProcThreadAttribute(attributes,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,handles,sizeof(handles),nullptr,nullptr);
    STARTUPINFOEXW startup{};startup.StartupInfo.cb=sizeof(startup);startup.StartupInfo.dwFlags=STARTF_USESTDHANDLES;startup.StartupInfo.hStdInput=input;startup.StartupInfo.hStdOutput=stdoutHandle;startup.StartupInfo.hStdError=stderrHandle;startup.lpAttributeList=attributes;
    std::wstring command=quoted(node);for(int i=4;i<argc;i++)command+=L" "+quoted(argv[i]);
    const auto temp=std::filesystem::path(project)/L".nexo"/L"temp";std::filesystem::create_directories(temp);
    wchar_t systemRoot[MAX_PATH]{};GetWindowsDirectoryW(systemRoot,MAX_PATH);
    std::vector<std::wstring> variables={L"PATH="+std::filesystem::path(node).parent_path().wstring()+L";"+std::wstring(systemRoot)+L"\\System32",L"SystemRoot="+std::wstring(systemRoot),L"TEMP="+temp.wstring(),L"TMP="+temp.wstring(),L"DOTNET_CLI_HOME="+temp.wstring(),L"DOTNET_CLI_TELEMETRY_OPTOUT=1",L"DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1",L"DOTNET_NOLOGO=1",L"NUGET_PACKAGES="+(temp/L"nuget").wstring(),L"MSBUILDDISABLENODEREUSE=1"};
    for(const auto key:{L"APPDATA",L"LOCALAPPDATA",L"USERPROFILE",L"ALLUSERSPROFILE",L"ProgramData",L"SystemDrive",L"windir"}){wchar_t value[32768]{};if(GetEnvironmentVariableW(key,value,32768))variables.push_back(std::wstring(key)+L"="+value);}
    std::sort(variables.begin(),variables.end(),[](const auto& a,const auto& b){return _wcsicmp(a.c_str(),b.c_str())<0;});
    std::vector<wchar_t> environment;for(const auto& variable:variables){environment.insert(environment.end(),variable.begin(),variable.end());environment.push_back(0);}environment.push_back(0);
    HANDLE job=CreateJobObjectW(nullptr,nullptr);JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE|JOB_OBJECT_LIMIT_ACTIVE_PROCESS|JOB_OBJECT_LIMIT_PROCESS_MEMORY|JOB_OBJECT_LIMIT_JOB_MEMORY;limits.BasicLimitInformation.ActiveProcessLimit=8;limits.ProcessMemoryLimit=1024ULL*1024*1024;limits.JobMemoryLimit=1536ULL*1024*1024;
    PROCESS_INFORMATION process{};
    if(attributesOk&&job&&SetInformationJobObject(job,JobObjectExtendedLimitInformation,&limits,sizeof(limits))&&CreateProcessW(node.c_str(),command.data(),nullptr,nullptr,TRUE,EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT|CREATE_NO_WINDOW|CREATE_SUSPENDED,environment.data(),project.c_str(),&startup.StartupInfo,&process)){
     if(AssignProcessToJobObject(job,process.hProcess)){
      ResumeThread(process.hThread);const auto wait=WaitForSingleObject(process.hProcess,60000);
      if(wait==WAIT_TIMEOUT){TerminateJobObject(job,124);std::cerr<<"Tempo limite de teste atingido.\n";result=124;}else{DWORD exitCode=125;GetExitCodeProcess(process.hProcess,&exitCode);result=static_cast<int>(exitCode);}
     }else{failure("job");TerminateProcess(process.hProcess,125);}
     CloseHandle(process.hThread);CloseHandle(process.hProcess);
    }else failure("criação do processo");
    if(job)CloseHandle(job);if(input)CloseHandle(input);if(stdoutHandle)CloseHandle(stdoutHandle);if(stderrHandle)CloseHandle(stderrHandle);DeleteProcThreadAttributeList(attributes);
   }else failure("atributos");
  }else failure("permissões");
 }
 FreeSid(sid);DeleteAppContainerProfile(profile.c_str());return result;
}
