import React from 'react';
export function CalculationDiagram({steps,result}){return <figure className="edu-calculation-diagram"><figcaption>O caminho do cálculo — operações efetuadas pela aplicação</figcaption><ol>{steps.map((step,i)=><li key={i}><span>{i+1}</span><strong>{step}</strong></li>)}</ol><p>Resultado exato: <strong>{result}</strong></p></figure>;}
