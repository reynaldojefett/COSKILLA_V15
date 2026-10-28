import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.zip.*;
import javax.xml.parsers.*;
import org.w3c.dom.*;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.*;
import org.mpxj.reader.UniversalProjectReader;

// Reads local files only. It never executes Office macros or writes the input.
public class CoskillaReader {
 static ObjectMapper json=new ObjectMapper();
 static Map<String,Object> map(Object... pairs){Map<String,Object> r=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)r.put((String)pairs[i],pairs[i+1]);return r;}
 public static void main(String[] args)throws Exception{
  if(args.length!=3)throw new IllegalArgumentException("Use budget|schedule input output");
  Object result=args[0].equals("materials-word")?wordMaterials(args[1]):args[0].equals("materials-project")?projectMaterials(args[1]):args[0].equals("budget")||args[1].toLowerCase().matches(".*\\.xlsx?$")?budget(args[1]):schedule(args[1]);
  json.writeValue(new File(args[2]),result);
 }
 static Object budget(String input)throws Exception{
  if(input.toLowerCase().endsWith(".xlsx"))return xlsx(input);
  List<Object>sheets=new ArrayList<>();boolean date1904=false;DataFormatter formatter=new DataFormatter(Locale.US);formatter.setUseCachedValuesForFormulaCells(true);
  try(InputStream in=Files.newInputStream(Path.of(input));HSSFWorkbook wb=new HSSFWorkbook(in)){date1904=wb.getWorkbook().isUsing1904DateWindowing();
   for(Sheet sheet:wb){List<Object>rows=new ArrayList<>(),displayRows=new ArrayList<>();if(sheet.getLastRowNum()>20000)throw new IOException("Demasiadas filas");
    for(int n=0;n<=sheet.getLastRowNum();n++){Row row=sheet.getRow(n);List<Object>values=new ArrayList<>(),display=new ArrayList<>();int count=row==null?0:Math.min(row.getLastCellNum(),100);
     for(int c=0;c<count;c++){Cell cell=row.getCell(c);display.add(cell==null?"":formatter.formatCellValue(cell));}
     for(int c=0;c<count;c++){Cell cell=row.getCell(c);if(cell==null){values.add("");continue;}CellType t=cell.getCellType()==CellType.FORMULA?cell.getCachedFormulaResultType():cell.getCellType();switch(t){case NUMERIC:values.add(cell.getNumericCellValue());break;case STRING:values.add(cell.getStringCellValue());break;case ERROR:values.add("#ERROR");break;default:values.add("");}}
     rows.add(values);displayRows.add(display);
    }sheets.add(map("name",sheet.getSheetName(),"rows",rows,"displayRows",displayRows));
   }
  }return map("sheets",sheets,"date1904",date1904);
 }
 static Object wordMaterials(String input)throws Exception{
  List<Object>sheets=new ArrayList<>();try(ZipFile zip=new ZipFile(input)){NodeList tables=xml(zip,"word/document.xml").getElementsByTagNameNS("*","tbl");
   for(int n=0;n<tables.getLength();n++){List<Object>rows=new ArrayList<>();NodeList rs=((Element)tables.item(n)).getElementsByTagNameNS("*","tr");if(rs.getLength()>20000)throw new IOException("Demasiadas filas");
    for(int r=0;r<rs.getLength();r++){List<Object>values=new ArrayList<>();NodeList cells=((Element)rs.item(r)).getElementsByTagNameNS("*","tc");for(int c=0;c<cells.getLength();c++){Element cell=(Element)cells.item(c);NodeList words=cell.getElementsByTagNameNS("*","t");StringBuilder text=new StringBuilder();for(int w=0;w<words.getLength();w++)text.append(words.item(w).getTextContent());values.add(text.toString());}rows.add(values);}sheets.add(map("name","Tabla "+(n+1),"rows",rows));}
  }return map("sheets",sheets);
 }
 static Object projectMaterials(String input)throws Exception{
  ProjectFile project=new UniversalProjectReader().read(input);if(project==null)throw new IOException("No se reconoció el formato del programa");List<Object>rows=new ArrayList<>();rows.add(Arrays.asList("Material","Unidad","Cantidad","Precio unitario","Fecha de llegada"));
  for(Resource r:project.getResources())if(r.getType()==ResourceType.MATERIAL)rows.add(Arrays.asList(r.getName()==null?"":r.getName(),r.getMaterialLabel()==null?"":r.getMaterialLabel(),"",r.getStandardRate()==null?"":r.getStandardRate().getAmount(),""));
  return map("sheets",Arrays.asList(map("name","Recursos materiales del programa","rows",rows)));
 }
 static Document xml(ZipFile z,String path)throws Exception{
  ZipEntry e=z.getEntry(path);if(e==null||e.getSize()>15000000)throw new IOException("XML ausente o demasiado grande");
  DocumentBuilderFactory f=DocumentBuilderFactory.newInstance();f.setNamespaceAware(true);f.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);f.setFeature("http://xml.org/sax/features/external-general-entities",false);f.setFeature("http://xml.org/sax/features/external-parameter-entities",false);f.setXIncludeAware(false);f.setExpandEntityReferences(false);
  try(InputStream in=z.getInputStream(e)){return f.newDocumentBuilder().parse(in);}
 }
 static String child(Element e,String name){NodeList l=e.getElementsByTagNameNS("*",name);return l.getLength()==0?"":l.item(0).getTextContent();}
 static Object xlsx(String input)throws Exception{
  List<Object>sheets=new ArrayList<>();boolean date1904=false;try(ZipFile z=new ZipFile(input)){
   if(z.size()>1000)throw new IOException("Demasiados archivos en Excel");
   DataFormatter formatter=new DataFormatter(Locale.US);Map<Integer,String>formats=new HashMap<>();List<Integer>styleFormats=new ArrayList<>();
   if(z.getEntry("xl/styles.xml")!=null){Document styles=xml(z,"xl/styles.xml");NodeList fmts=styles.getElementsByTagNameNS("*","numFmt");for(int f=0;f<fmts.getLength();f++){Element fmt=(Element)fmts.item(f);formats.put(Integer.parseInt(fmt.getAttribute("numFmtId")),fmt.getAttribute("formatCode"));}NodeList xfs=styles.getElementsByTagNameNS("*","cellXfs");if(xfs.getLength()>0){NodeList entries=((Element)xfs.item(0)).getElementsByTagNameNS("*","xf");for(int f=0;f<entries.getLength();f++){String id=((Element)entries.item(f)).getAttribute("numFmtId");styleFormats.add(id.isEmpty()?0:Integer.parseInt(id));}}}
   List<String>strings=new ArrayList<>();if(z.getEntry("xl/sharedStrings.xml")!=null){NodeList si=xml(z,"xl/sharedStrings.xml").getElementsByTagNameNS("*","si");for(int i=0;i<si.getLength();i++)strings.add(si.item(i).getTextContent());}
   Map<String,String>rels=new HashMap<>();NodeList rl=xml(z,"xl/_rels/workbook.xml.rels").getElementsByTagNameNS("*","Relationship");for(int i=0;i<rl.getLength();i++){Element e=(Element)rl.item(i);rels.put(e.getAttribute("Id"),e.getAttribute("Target"));}
   Document workbook=xml(z,"xl/workbook.xml");NodeList props=workbook.getElementsByTagNameNS("*","workbookPr");if(props.getLength()>0){String flag=((Element)props.item(0)).getAttribute("date1904");date1904=flag.equals("1")||flag.equals("true");}
   NodeList sh=workbook.getElementsByTagNameNS("*","sheet");for(int i=0;i<sh.getLength();i++){
    Element se=(Element)sh.item(i);String target=rels.get(se.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id"));if(target==null||target.contains(".."))throw new IOException("Ruta inválida");target=target.startsWith("/")?target.substring(1):"xl/"+target;
    NodeList rs=xml(z,target).getElementsByTagNameNS("*","row");if(rs.getLength()>20000)throw new IOException("Demasiadas filas");List<Object>rows=new ArrayList<>(),displayRows=new ArrayList<>();
    for(int r=0;r<rs.getLength();r++){Element row=(Element)rs.item(r);NodeList cs=row.getElementsByTagNameNS("*","c");List<Object>values=new ArrayList<>(),display=new ArrayList<>();for(int c=0;c<cs.getLength();c++){Element cell=(Element)cs.item(c);String ref=cell.getAttribute("r").replaceAll("[0-9]","");int ix=0;for(char ch:ref.toCharArray())ix=ix*26+ch-'A'+1;if(ix<1||ix>100)continue;while(values.size()<ix){values.add("");display.add("");}String t=cell.getAttribute("t"),v=child(cell,"v");Object value=v;if(t.equals("s"))value=strings.get(Integer.parseInt(v));else if(t.equals("inlineStr"))value=child(cell,"is");else if(t.equals("e"))value="#ERROR";else if(!t.equals("str")&&!t.equals("d")&&!v.isEmpty()){try{value=Double.valueOf(v);}catch(NumberFormatException ex){value=v;}}values.set(ix-1,value);String shown=String.valueOf(value);if(value instanceof Number){String style=cell.getAttribute("s");int styleIndex=style.isEmpty()?0:Integer.parseInt(style),formatId=styleIndex<styleFormats.size()?styleFormats.get(styleIndex):0;String format=formats.getOrDefault(formatId,BuiltinFormats.getBuiltinFormat(formatId));shown=formatter.formatRawCellContents(((Number)value).doubleValue(),formatId,format==null?"General":format,date1904);}display.set(ix-1,shown);}rows.add(values);displayRows.add(display);}
    sheets.add(map("name",se.getAttribute("name"),"rows",rows,"displayRows",displayRows));
   }
  }return map("sheets",sheets,"date1904",date1904);
 }
 static Object schedule(String input)throws Exception{
  ProjectFile p=new UniversalProjectReader().read(input);if(p==null)throw new IOException("Formato no reconocido");
  List<Object>tasks=new ArrayList<>();if(p.getTasks().size()>5000)throw new IOException("Demasiadas tareas");
  for(Task t:p.getTasks()){
   if(t.getName()==null||t.getStart()==null||t.getFinish()==null)continue;
   LocalDateTime start=t.getStart(),finish=t.getFinish();if(ChronoUnit.DAYS.between(start,finish)>3700)throw new IOException("Tarea de más de diez años");
   List<Object>days=new ArrayList<>();if(!t.getSummary())for(LocalDate d=start.toLocalDate();!d.isAfter(finish.toLocalDate());d=d.plusDays(1)){
    LocalDateTime a=d.atStartOfDay().isBefore(start)?start:d.atStartOfDay(),b=d.plusDays(1).atStartOfDay().isAfter(finish)?finish:d.plusDays(1).atStartOfDay();
    double hours=b.isAfter(a)?t.getEffectiveCalendar().getWork(a,b,TimeUnit.HOURS).getDuration():0;
    double calendarHours=t.getEffectiveCalendar().getWork(d.atStartOfDay(),d.plusDays(1).atStartOfDay(),TimeUnit.HOURS).getDuration();
    if(hours>0)days.add(map("date",d.toString(),"hours",hours,"calendarHours",calendarHours));
   }
   String parent="";Task ancestor=t.getParentTask();while(ancestor!=null){parent=ancestor.getName()+" / "+parent;ancestor=ancestor.getParentTask();}
   List<Object> predecessors=new ArrayList<>();for(Relation r:t.getPredecessors()){Task before=r.getPredecessorTask();if(before!=null)predecessors.add(map("id",String.valueOf(before.getUniqueID()),"type",r.getType().name(),"lag",r.getLag()==null?"":r.getLag().toString(),"lagValue",r.getLag()==null?0:r.getLag().getDuration(),"lagUnits",r.getLag()==null?null:r.getLag().getUnits().name()));}
   Object criticalValue=t.getCachedValue(TaskField.CRITICAL);org.mpxj.Duration slack=t.getTotalSlack();Boolean critical=criticalValue instanceof Boolean?(Boolean)criticalValue:slack==null?null:slack.getDuration()<=0;Double slackHours=slack==null?null:slack.convertUnits(org.mpxj.TimeUnit.HOURS,p.getProjectProperties()).getDuration();
   tasks.add(map("critical",critical,"criticalBasis",criticalValue instanceof Boolean?"Marca del programa importado":slack==null?null:"Holgura total importada","totalSlackHours",slackHours,"calendarName",t.getEffectiveCalendar().getName(),"sourceStartTime",start.toLocalTime().toString(),"sourceFinishTime",finish.toLocalTime().toString(),"predecessors",predecessors,"id",String.valueOf(t.getUniqueID()),"wbs",t.getWBS(),"activityId",t.getActivityID(),"budgetCode",t.getText(1),"name",t.getName(),"parent",parent,"start",start.toLocalDate().toString(),"finish",finish.toLocalDate().toString(),"summary",t.getSummary(),"milestone",t.getMilestone(),"sourceDuration",String.valueOf(t.getDuration()),"cost",t.getCost(),"days",days,"baselineStart",t.getBaselineStart()==null?null:t.getBaselineStart().toString(),"baselineFinish",t.getBaselineFinish()==null?null:t.getBaselineFinish().toString()));
  }
  return map("tasks",tasks,"method","Distribución uniforme por horas laborables del calendario de cada tarea; sin reproducir perfiles de recursos ni recalcular la ruta crítica.");
 }
}

