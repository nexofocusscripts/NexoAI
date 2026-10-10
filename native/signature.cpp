#define UNICODE
#include <windows.h>
#include <wintrust.h>
#include <softpub.h>
#include <wincrypt.h>
#include <iostream>
#include <vector>
#pragma comment(lib,"wintrust.lib")
#pragma comment(lib,"crypt32.lib")
int wmain(int argc,wchar_t** argv){
 if(argc!=2)return 2;
 WINTRUST_FILE_INFO file{};file.cbStruct=sizeof(file);file.pcwszFilePath=argv[1];
 WINTRUST_DATA trust{};trust.cbStruct=sizeof(trust);trust.dwUIChoice=WTD_UI_NONE;trust.fdwRevocationChecks=WTD_REVOKE_NONE;trust.dwUnionChoice=WTD_CHOICE_FILE;trust.pFile=&file;trust.dwStateAction=WTD_STATEACTION_VERIFY;
 GUID policy=WINTRUST_ACTION_GENERIC_VERIFY_V2;const auto status=WinVerifyTrust(nullptr,&policy,&trust);trust.dwStateAction=WTD_STATEACTION_CLOSE;WinVerifyTrust(nullptr,&policy,&trust);
 if(status!=ERROR_SUCCESS){std::cerr<<"Assinatura Windows inválida: "<<status;return 3;}
 HCERTSTORE store=nullptr;HCRYPTMSG message=nullptr;
 if(!CryptQueryObject(CERT_QUERY_OBJECT_FILE,argv[1],CERT_QUERY_CONTENT_FLAG_PKCS7_SIGNED_EMBED,CERT_QUERY_FORMAT_FLAG_BINARY,0,nullptr,nullptr,nullptr,&store,&message,nullptr))return 3;
 DWORD bytes=0;CryptMsgGetParam(message,CMSG_SIGNER_INFO_PARAM,0,nullptr,&bytes);std::vector<BYTE> buffer(bytes);
 int result=3;
 if(CryptMsgGetParam(message,CMSG_SIGNER_INFO_PARAM,0,buffer.data(),&bytes)){
  const auto signer=reinterpret_cast<CMSG_SIGNER_INFO*>(buffer.data());CERT_INFO info{};info.Issuer=signer->Issuer;info.SerialNumber=signer->SerialNumber;
  const auto cert=CertFindCertificateInStore(store,X509_ASN_ENCODING|PKCS_7_ASN_ENCODING,0,CERT_FIND_SUBJECT_CERT,&info,nullptr);
  if(cert){wchar_t name[512]{};CertGetNameStringW(cert,CERT_NAME_SIMPLE_DISPLAY_TYPE,0,nullptr,name,512);if(std::wstring(name)==L"Ollama Inc."){std::cout<<"{\"status\":\"Valid\",\"subject\":\"Ollama Inc.\"}";result=0;}else std::cerr<<"Editor do runtime não aprovado.";CertFreeCertificateContext(cert);}
 }
 CryptMsgClose(message);CertCloseStore(store,0);return result;
}
