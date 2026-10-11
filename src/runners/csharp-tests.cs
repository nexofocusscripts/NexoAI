using System;
using System.Reflection;
using System.Threading.Tasks;
[AttributeUsage(AttributeTargets.Method)] public sealed class NexoTestAttribute:Attribute {}
public static class NexoAssert {
 public static void Equal<T>(T expected,T actual){if(!Equals(expected,actual))throw new Exception($"Esperado {expected}; recebido {actual}");}
 public static void True(bool value){if(!value)throw new Exception("Condição falsa");}
 public static void Throws<T>(Action action) where T:Exception {try{action();}catch(T){return;}throw new Exception("A exceção esperada não ocorreu");}
}
public static class NexoRunner {
 public static async Task<int> Main(){int count=0,failed=0;foreach(var type in Assembly.GetExecutingAssembly().GetTypes())foreach(var method in type.GetMethods(BindingFlags.Public|BindingFlags.Static)){if(!method.IsDefined(typeof(NexoTestAttribute),false))continue;count++;try{if(method.GetParameters().Length!=0)throw new Exception("Teste deve ser estático e sem argumentos");var result=method.Invoke(null,null);if(result is Task task)await task;else if(method.ReturnType!=typeof(void))throw new Exception("Teste deve devolver void ou Task");Console.Error.WriteLine("PASS "+type.Name+"."+method.Name);}catch(Exception e){failed++;Console.Error.WriteLine("FAIL "+type.Name+"."+method.Name+": "+(e.InnerException??e).Message);}}Console.Error.WriteLine($"NEXO_CSHARP_TESTS={count} FAILED={failed}");return count>0&&failed==0?0:1;}
}
