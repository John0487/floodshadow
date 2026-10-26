"""Use native Word for PDF conversion when the packaged renderer has no Windows LibreOffice.
The canonical render_docx rasterizer still creates the reviewed page PNGs.
"""
import importlib.util, os, shutil, sys
from pathlib import Path
import win32com.client
ROOT=Path(__file__).resolve().parents[1]
renderer=Path.home()/'.codex/plugins/cache/openai-primary-runtime/documents/26.1025.11240/skills/documents/render_docx.py'
spec=importlib.util.spec_from_file_location('canonical_render_docx',renderer)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
poppler=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin'
os.environ['PATH']=str(poppler)+os.pathsep+os.environ.get('PATH','')
app=win32com.client.DispatchEx('Word.Application')
app.Visible=False;app.DisplayAlerts=0
def convert(doc_path,user_profile,convert_tmp_dir,stem,verbose=False):
    target=str(Path(convert_tmp_dir)/(stem+'.pdf'))
    doc=app.Documents.Open(str(Path(doc_path).resolve()),ConfirmConversions=False,ReadOnly=True,AddToRecentFiles=False)
    try:
        doc.Repaginate()
        doc.ExportAsFixedFormat(target,17,OpenAfterExport=False)
    finally:doc.Close(False)
    return target,'Native Microsoft Word PDF conversion; packaged render_docx.py rasterizer'
module.convert_to_pdf=convert
try:
    for kind,stem in ([('presentation',sys.argv[1])] if len(sys.argv)>1 else [('proposal','FLOODSHADOW_3Jota_Proposal_EN'),('guide','FLOODSHADOW_3Jota_Guia_ES')]):
        path=ROOT/'docs'/'entrega'/(stem+'.docx')
        qa=ROOT/'data-cache'/'doc-qa'/kind
        pages=module.rasterize(str(path),str(qa),144,False,True)
        shutil.copy2(qa/(stem+'.pdf'),ROOT/'docs'/'entrega'/(stem+'.pdf'))
        print(kind,len(pages),'pages',flush=True)
finally:app.Quit(False)
