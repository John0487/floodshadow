import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

// Translators can replace Text nodes. React must remove a stable element, not
// a Text node which an external translator has already detached. No DOM patches.
const restricted = new Set(['option','textarea','title','style','script','svg','text','tspan','table','thead','tbody','tr','select']);
function containsUI(n) {
  if (!n) return false;
  if (t.isJSXElement(n) || t.isJSXFragment(n)) return true;
  if (t.isCallExpression(n) && (t.isMemberExpression(n.callee) && ['map','createElement'].includes(n.callee.property.name))) return true;
  if (t.isMemberExpression(n) && n.property?.name === 'children') return true;
  return (t.VISITOR_KEYS[n.type] ?? []).some(k => Array.isArray(n[k]) ? n[k].some(containsUI) : containsUI(n[k]));
}
export function protectText(code, filename='view.jsx') {
  const ast=parse(code,{sourceType:'module',plugins:['jsx'],sourceFilename:filename});
  traverse(ast,{JSXElement:{exit(path){
    const el=path.node, name=el.openingElement.name;
    if (!t.isJSXIdentifier(name) || !/^[a-z]/.test(name.name) || restricted.has(name.name)) return;
    if (el.openingElement.attributes.some(a=>a.name?.name==='data-stable-text')) return;
    el.children=el.children.map(child=>{
      if (!(t.isJSXText(child) && child.value.trim()) && !(t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression) && !containsUI(child.expression))) return child;
      // A sole child has no sibling removal hazard and React updates textContent.
      // Wrapping mixed children and conditional text supplies a stable removal target.
      if (el.children.length===1 && t.isJSXText(child)) return child;
      const attrs=[t.jsxAttribute(t.jsxIdentifier('data-stable-text'))];
      return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('span'),attrs),t.jsxClosingElement(t.jsxIdentifier('span')),[child]);
    });
  }}});
  return generate(ast,{sourceMaps:true,sourceFileName:filename},code);
}
export default function translationSafeJSX(){return {name:'translation-stable-text',enforce:'pre',transform(code,id){if(!id.includes('/src/')||!id.endsWith('.jsx'))return;return protectText(code,id);}};}
