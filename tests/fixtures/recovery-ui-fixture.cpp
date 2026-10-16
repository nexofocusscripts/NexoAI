#include <windows.h>
#include <string>
#include <iostream>
#pragma comment(lib,"user32.lib")
struct Dialog {DWORD pid;std::wstring decision;bool handled=false;bool visible=false;};
static BOOL CALLBACK inspect(HWND window,LPARAM parameter){auto& state=*reinterpret_cast<Dialog*>(parameter);if(state.handled)return FALSE;DWORD owner=0;GetWindowThreadProcessId(window,&owner);if(owner!=state.pid)return TRUE;wchar_t title[128]{};GetWindowTextW(window,title,128);if(std::wstring(title)!=L"Recuperar Nexo AI")return TRUE;const bool visible=IsWindowVisible(window)!=FALSE;state.visible=state.visible||visible;if(!visible)return TRUE;const int button=state.decision==L"yes"?IDYES:state.decision==L"no"?IDNO:IDOK;if(!GetDlgItem(window,button))return TRUE;state.handled=true;DWORD_PTR result=0;SendMessageTimeoutW(window,WM_COMMAND,MAKEWPARAM(button,BN_CLICKED),reinterpret_cast<LPARAM>(GetDlgItem(window,button)),SMTO_ABORTIFHUNG,1000,&result);return FALSE;}
int wmain(int argc,wchar_t** argv){
 if(argc!=3)return 2;const std::wstring runner=argv[1],decision=argv[2];if(decision!=L"yes"&&decision!=L"no"&&decision!=L"error")return 3;
 const auto name=L"NexoRecoveryTest_"+std::to_wstring(GetCurrentProcessId())+L"_"+std::to_wstring(GetTickCount64());HDESK desktop=CreateDesktopW(name.c_str(),nullptr,nullptr,0,DESKTOP_CREATEWINDOW|DESKTOP_ENUMERATE|DESKTOP_READOBJECTS|DESKTOP_WRITEOBJECTS,nullptr);if(!desktop)return 4;
 STARTUPINFOW startup{};startup.cb=sizeof(startup);startup.lpDesktop=const_cast<wchar_t*>(name.c_str());startup.dwFlags=STARTF_USESHOWWINDOW;startup.wShowWindow=SW_HIDE;PROCESS_INFORMATION child{};auto command=L"\""+runner+L"\" --recover";if(!CreateProcessW(runner.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_NO_WINDOW,nullptr,nullptr,&startup,&child)){CloseDesktop(desktop);return 5;}CloseHandle(child.hThread);Dialog state{child.dwProcessId,decision};
 for(unsigned i=0;i<600;i++){EnumDesktopWindows(desktop,inspect,reinterpret_cast<LPARAM>(&state));if(WaitForSingleObject(child.hProcess,100)==WAIT_OBJECT_0)break;}
 DWORD code=0;if(WaitForSingleObject(child.hProcess,0)!=WAIT_OBJECT_0){TerminateProcess(child.hProcess,6);WaitForSingleObject(child.hProcess,10000);code=6;}else GetExitCodeProcess(child.hProcess,&code);CloseHandle(child.hProcess);CloseDesktop(desktop);if(!state.handled||!state.visible){std::cerr<<"recovery dialog not handled; exit="<<code<<" visible="<<state.visible<<"\n";return 7;}return static_cast<int>(code);
}
