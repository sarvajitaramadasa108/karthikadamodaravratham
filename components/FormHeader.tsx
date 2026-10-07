import { Flame } from 'lucide-react';
export default function FormHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-top"><a className="back-link" href="/"><Flame size={17} style={{verticalAlign:'middle', marginRight:6}}/> Damodara Vratham</a><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
