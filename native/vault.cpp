#define UNICODE
#include <windows.h>
#include <wincrypt.h>
#include <iostream>
#include <iterator>
#include <vector>
#include <string>
#pragma comment(lib,"crypt32.lib")
int wmain(int argc,wchar_t** argv){
 if(argc!=2)return 2;
 const std::string input(std::istreambuf_iterator<char>(std::cin),{});if(input.size()>32768)return 2;
 DATA_BLOB source{},output{};
 if(std::wstring(argv[1])==L"encrypt"){
  source.pbData=reinterpret_cast<BYTE*>(const_cast<char*>(input.data()));source.cbData=static_cast<DWORD>(input.size());
  if(!CryptProtectData(&source,L"Nexo AI credencial",nullptr,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&output))return 3;
  DWORD length=0;CryptBinaryToStringA(output.pbData,output.cbData,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,nullptr,&length);std::vector<char> encoded(length);
  if(!CryptBinaryToStringA(output.pbData,output.cbData,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,encoded.data(),&length)){LocalFree(output.pbData);return 3;}
  std::cout<<encoded.data();SecureZeroMemory(output.pbData,output.cbData);LocalFree(output.pbData);
 }else if(std::wstring(argv[1])==L"decrypt"){
  DWORD length=0;if(!CryptStringToBinaryA(input.data(),static_cast<DWORD>(input.size()),CRYPT_STRING_BASE64,nullptr,&length,nullptr,nullptr))return 3;
  std::vector<BYTE> decoded(length);if(!CryptStringToBinaryA(input.data(),static_cast<DWORD>(input.size()),CRYPT_STRING_BASE64,decoded.data(),&length,nullptr,nullptr))return 3;
  source.pbData=decoded.data();source.cbData=length;
  if(!CryptUnprotectData(&source,nullptr,nullptr,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&output))return 3;
  std::cout.write(reinterpret_cast<char*>(output.pbData),output.cbData);SecureZeroMemory(output.pbData,output.cbData);LocalFree(output.pbData);
 }else return 2;
 return 0;
}
