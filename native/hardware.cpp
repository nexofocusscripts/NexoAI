#define UNICODE
#define _UNICODE
#include <windows.h>
#include <dxgi.h>
#include <iostream>
#include <string>
#pragma comment(lib,"dxgi.lib")
static std::string utf8(const wchar_t* value){int n=WideCharToMultiByte(CP_UTF8,0,value,-1,nullptr,0,nullptr,nullptr);std::string s(n,'\0');WideCharToMultiByte(CP_UTF8,0,value,-1,s.data(),n,nullptr,nullptr);s.resize(n-1);return s;}
static std::string quote(const std::string& value){std::string result="\"";for(unsigned char c:value){if(c=='"'||c=='\\')result+='\\';if(c<32){const char* h="0123456789abcdef";result+="\\u00";result+=h[c>>4];result+=h[c&15];}else result+=c;}return result+'"';}
int main(){IDXGIFactory1* factory=nullptr;if(FAILED(CreateDXGIFactory1(__uuidof(IDXGIFactory1),(void**)&factory)))return 1;std::cout<<"[";bool first=true;IDXGIAdapter1* adapter=nullptr;for(UINT i=0;factory->EnumAdapters1(i,&adapter)!=DXGI_ERROR_NOT_FOUND;i++){DXGI_ADAPTER_DESC1 d{};if(SUCCEEDED(adapter->GetDesc1(&d))&&!(d.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)){if(!first)std::cout<<",";first=false;std::cout<<"{\"name\":"<<quote(utf8(d.Description))<<",\"vendorId\":"<<d.VendorId<<",\"deviceId\":"<<d.DeviceId<<",\"dedicatedBytes\":"<<(unsigned long long)d.DedicatedVideoMemory<<",\"sharedBytes\":"<<(unsigned long long)d.SharedSystemMemory<<"}";}adapter->Release();adapter=nullptr;}std::cout<<"]";factory->Release();return 0;}
