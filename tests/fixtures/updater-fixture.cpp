#include <windows.h>
#include <filesystem>
#include <fstream>
#include <string>
namespace fs=std::filesystem;
int wmain(int argc,wchar_t** argv){
 if(argc>1&&std::wstring(argv[1])==L"--parent"){Sleep(250);return 0;}
 if(argc<2||std::wstring(argv[1])!=L"/S")return 0;
 wchar_t rootBuffer[32768];if(!GetEnvironmentVariableW(L"NEXO_NATIVE_UPDATE_TEST_ROOT",rootBuffer,32768))return 81;
 std::wstring destination;for(int i=2;i<argc;i++){std::wstring arg=argv[i];if(arg.rfind(L"/D=",0)==0){destination=arg.substr(3);for(int j=i+1;j<argc;j++)destination+=L" "+std::wstring(argv[j]);break;}}
 const auto root=fs::weakly_canonical(rootBuffer),app=fs::weakly_canonical(destination);const auto relative=app.lexically_relative(root);if(relative.empty()||*relative.begin()==L"..")return 82;
 fs::create_directories(app);std::ofstream(app/L"partial.txt")<<"partial install";
 wchar_t fail[10],hold[20];if(GetEnvironmentVariableW(L"NEXO_TEST_INSTALL_HOLD_MS",hold,20))Sleep(wcstoul(hold,nullptr,10));
 if(GetEnvironmentVariableW(L"NEXO_TEST_INSTALL_FAIL",fail,10))return 7;
 std::ofstream(app/L"version.txt")<<"1.0.7";std::ofstream(app/L"new-file.txt")<<"candidate";fs::remove(app/L"partial.txt");return 0;
}
