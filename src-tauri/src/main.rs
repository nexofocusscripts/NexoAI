#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde_json::Value;
use std::{fs, net::TcpListener, process::{Child, Command, Stdio}, sync::Mutex, time::Duration};
use tauri::{Manager, State};
#[cfg(windows)] use std::os::windows::process::CommandExt;

struct Backend { child: Mutex<Child>, port: u16, token: String, client: reqwest::Client, data:std::path::PathBuf, _job: ProcessJob }
struct ProcessJob(isize);
unsafe impl Send for ProcessJob {}
unsafe impl Sync for ProcessJob {}
impl Drop for ProcessJob {fn drop(&mut self){#[cfg(windows)] unsafe{if self.0!=0{windows_sys::Win32::Foundation::CloseHandle(self.0 as _);}}}}
fn contain(child:&Child)->Result<ProcessJob,std::io::Error>{
 #[cfg(windows)] unsafe {
  use std::os::windows::io::AsRawHandle;
  use windows_sys::Win32::System::JobObjects::*;
  let handle=CreateJobObjectW(std::ptr::null(),std::ptr::null());if handle.is_null(){return Err(std::io::Error::last_os_error());}
  let job=ProcessJob(handle as isize);let mut limits:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if SetInformationJobObject(handle,JobObjectExtendedLimitInformation,&limits as *const _ as _,std::mem::size_of_val(&limits) as u32)==0||AssignProcessToJobObject(handle,child.as_raw_handle() as _)==0{return Err(std::io::Error::last_os_error());}return Ok(job);
 }
 #[cfg(not(windows))] {let _=child;Ok(ProcessJob(0))}
}

#[tauri::command]
async fn save_file(name:String,content:String,image:bool)->Result<bool,String>{
 use base64::Engine;
 if name.len()>160||name.contains(['\\','/',':','\0'])||content.len()>8_000_000{return Err("Ficheiro de exportação inválido.".into());}
 let bytes=if image{base64::engine::general_purpose::STANDARD.decode(content).map_err(|_|"Imagem inválida.".to_string())?}else{content.into_bytes()};
 if image&&!bytes.starts_with(&[137,80,78,71,13,10,26,10]){return Err("Imagem PNG inválida.".into());}
 let mut dialog=rfd::AsyncFileDialog::new().set_file_name(&name).set_title("Guardar ficheiro do Nexo AI");
 if image{dialog=dialog.add_filter("Imagem PNG",&["png"]);}
 if let Some(file)=dialog.save_file().await{file.write(&bytes).await.map_err(|_|"Não foi possível guardar o ficheiro.".to_string())?;return Ok(true)}
 Ok(false)
}

#[tauri::command]
async fn choose_update(state:State<'_,Backend>)->Result<Value,String>{
 let selected=rfd::AsyncFileDialog::new().set_title("Selecionar atualização assinada do Nexo AI").add_filter("Atualização Nexo AI",&["nexoupdate"]).pick_file().await;
 let Some(file)=selected else{return Ok(serde_json::json!({"cancelled":true}))};
 state.client.post(format!("http://127.0.0.1:{}/api/update/prepare-local",state.port)).header("X-Nexo-Token",&state.token).json(&serde_json::json!({"path":file.path().to_string_lossy()})).send().await.map_err(|_|"Serviço de atualização indisponível.".to_string())?.json().await.map_err(|_|"Resposta de atualização inválida.".to_string())
}

#[tauri::command]
async fn apply_update(id:String,app:tauri::AppHandle,state:State<'_,Backend>)->Result<bool,String>{
 let plan:Value=state.client.post(format!("http://127.0.0.1:{}/api/update/consume",state.port)).header("X-Nexo-Token",&state.token).json(&serde_json::json!({"id":id,"confirmed":true})).send().await.map_err(|_|"Serviço de atualização indisponível.".to_string())?.json().await.map_err(|_|"Resposta de atualização inválida.".to_string())?;
 if let Some(error)=plan.get("error").and_then(Value::as_str){return Err(error.to_string())}
 let directory=std::path::PathBuf::from(plan["directory"].as_str().ok_or("Pasta de atualização inválida.")?);
 let rollback=state.data.join("updates").join("rollback");
 let update_root=fs::canonicalize(state.data.join("updates")).map_err(|_|"Pasta de atualização indisponível.".to_string())?;
 if !fs::canonicalize(&directory).map_err(|_|"Pacote indisponível.".to_string())?.starts_with(&update_root){return Err("Pacote fora da pasta de atualizações.".into())}
 let mode=plan["mode"].as_str().ok_or("Operação inválida.")?;if mode!="install"&&mode!="rollback"{return Err("Operação inválida.".into())}
 fs::create_dir_all(&rollback).map_err(|_|"Não foi possível preparar a recuperação.".to_string())?;
 let source=app.path().resource_dir().map_err(|_|"Recursos indisponíveis.".to_string())?.join("backend").join("nexo-updater.exe");
 let runner=update_root.join(format!("runner-{}.exe",uuid::Uuid::new_v4()));fs::copy(source,&runner).map_err(|_|"Não foi possível preparar o atualizador.".to_string())?;
 let executable=std::env::current_exe().map_err(|_|"Aplicação indisponível.".to_string())?;
 let install=executable.parent().ok_or("Pasta de instalação inválida.")?;
 if update_root.starts_with(install)||install.starts_with(&update_root){return Err("A instalação precisa de uma pasta própria, separada dos dados, para permitir recuperação segura.".into())}
 let mut command=Command::new(runner);command.arg(mode).arg(std::process::id().to_string()).arg(install).arg(directory).arg(rollback).arg(executable.file_name().ok_or("Aplicação inválida.")?).arg(env!("CARGO_PKG_VERSION")).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
 #[cfg(windows)] command.creation_flags(0x08000000);
 command.spawn().map_err(|_|"Não foi possível iniciar o atualizador.".to_string())?;
 std::thread::spawn(move||{std::thread::sleep(Duration::from_secs(1));app.exit(0)});Ok(true)
}

#[tauri::command]
async fn api(route: String, method: String, body: Option<Value>, state: State<'_, Backend>) -> Result<Value, String> {
    if !route.starts_with("/api/") || route.contains(['\\', '#', '\r', '\n']) || route.contains("..") { return Err("Pedido inválido.".into()); }
    let verb = match method.as_str() { "GET"=>reqwest::Method::GET,"POST"=>reqwest::Method::POST,"PUT"=>reqwest::Method::PUT,"DELETE"=>reqwest::Method::DELETE,_=>return Err("Método inválido.".into()) };
    let mut request=state.client.request(verb,format!("http://127.0.0.1:{}{}",state.port,route)).header("X-Nexo-Token",&state.token);
    if let Some(payload)=body { request=request.json(&payload); }
    let response=request.send().await.map_err(|_|"Não foi possível comunicar com o serviço local.".to_string())?;
    let value:Value=response.json().await.map_err(|_|"Resposta inválida do serviço local.".to_string())?;
    Ok(value)
}

#[tauri::command]
async fn save_project_zip(id:String,state:State<'_,Backend>)->Result<bool,String>{
 if id.len()!=36||!id.bytes().all(|b|b.is_ascii_hexdigit()||b==b'-'){return Err("Entrega inválida.".into());}
 let response=state.client.get(format!("http://127.0.0.1:{}/api/agent/delivery/export?id={}",state.port,id)).header("X-Nexo-Token",&state.token).send().await.map_err(|_|"Entrega local indisponível.".to_string())?;
 if !response.status().is_success()||response.headers().get("content-type").and_then(|v|v.to_str().ok())!=Some("application/zip"){return Err("A entrega não está disponível ou não passou a verificação.".into());}
 if response.content_length().map_or(true,|length|length>32_000_000){return Err("Entrega demasiado grande.".into());}
 let bytes=response.bytes().await.map_err(|_|"Não foi possível ler a entrega.".to_string())?;
 if bytes.len()>32_000_000||!bytes.starts_with(&[80,75,3,4]){return Err("ZIP inválido.".into());}
 let selected=rfd::AsyncFileDialog::new().set_title("Guardar projeto entregue pelo Nexo AI").set_file_name("Projeto-NexoAI.zip").add_filter("Projeto ZIP",&["zip"]).save_file().await;
 if let Some(file)=selected{file.write(&bytes).await.map_err(|_|"Não foi possível guardar o ZIP.".to_string())?;return Ok(true)}Ok(false)
}

fn main() {
    let app=tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.set_focus();}})).invoke_handler(tauri::generate_handler![api,save_file,save_project_zip,choose_update,apply_update]).setup(|app| {
        let resource=app.path().resource_dir()?;
        let backend=resource.join("backend");
        let data=app.path().app_local_data_dir()?;
        fs::create_dir_all(&data)?;
        let port=TcpListener::bind("127.0.0.1:0")?.local_addr()?.port();
        let token=uuid::Uuid::new_v4().to_string();
        let log=fs::OpenOptions::new().create(true).append(true).open(data.join("service.log"))?;
        let mut command=Command::new(backend.join("node.exe"));
        command.arg(backend.join("src/server.mjs")).env("NEXO_PORT",port.to_string()).env("NEXO_API_TOKEN",&token).env("NEXO_DATA_DIR",&data).env("NEXO_DESKTOP","1").env("OLLAMA_URL","http://127.0.0.1:11434").env("NODE_USE_SYSTEM_CA","1").env("NEXO_SANDBOX_EXE",backend.join("nexo-sandbox.exe")).env("NEXO_VAULT_EXE",backend.join("nexo-vault.exe")).env("NEXO_SIGNATURE_EXE",backend.join("nexo-signature.exe")).current_dir(&backend).stdin(Stdio::null()).stdout(Stdio::from(log.try_clone()?)).stderr(Stdio::from(log));
        #[cfg(windows)] command.creation_flags(0x08000000);
        let client=reqwest::Client::builder().no_proxy().timeout(Duration::from_secs(600)).build()?;
        let mut child=command.spawn()?;
        let job=match contain(&child){Ok(job)=>job,Err(error)=>{let _=child.kill();return Err(error.into())}};
        app.manage(Backend {child:Mutex::new(child),port,token,client,data,_job:job});
        Ok(())
    }).build(tauri::generate_context!());
    let app=match app{Ok(value)=>value,Err(_)=>{rfd::MessageDialog::new().set_title("Nexo AI").set_description("Não foi possível iniciar o serviço local. Confirma que a instalação está completa e que existe espaço livre no disco. Podes voltar a executar o instalador para reparar a aplicação; os projetos são guardados separadamente.").set_level(rfd::MessageLevel::Error).show();return}};
    app.run(|handle,event| {if matches!(event,tauri::RunEvent::Exit){if let Some(state)=handle.try_state::<Backend>(){if let Ok(mut child)=state.child.lock(){let _=child.kill();let _=child.wait();}}}});
}
