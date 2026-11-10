"""Build estimated concept robot meshes. Run from root: blender -b --python scripts/build-models.py"""
import bpy,math,os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def xyz(p):return (p[0],-p[2],p[1])
def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if metal<.4:p.inputs['Coat Weight'].default_value=.25
 return m
steel=material('Brushed alloy',(.55,.62,.68),.85,.29);chrome=material('Machined steel',(.69,.73,.77),.95,.2);dark=material('Graphite housings',(.035,.048,.065),.4,.34);rubber=material('Rubber contact lips',(.012,.017,.023),0,.75);white=material('Powder coated pedestal',(.72,.77,.78),.35,.34);blue=material('Pneumatic tubing',(.025,.19,.43),.1,.37)
paints=[material('Loader orange',(.92,.24,.025),.2,.31),material('Capper silver',(.56,.65,.7),.75,.3),material('Closer yellow',(.94,.63,.025),.2,.31)]
def group(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def finish(o,m,parent,bevel=0):
 o.data.materials.append(m);o.parent=parent
 if bevel:
  mod=o.modifiers.new('Machined edge radii','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 return o
def cube(name,dim,pos,m,parent,bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object;o.name=name;o.dimensions=(dim[0],dim[2],dim[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,m,parent,bevel)
def cyl(name,r,depth,pos,m,parent,axis=(0,1,0),r2=None,verts=32):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=xyz(pos));o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(xyz(axis)));return finish(o,m,parent,.004)
for i,name in enumerate(['loader','capper','closer']):
 paint=paints[i];base=group(name+'_base');upper=group(name+'_upper');fore=group(name+'_fore');wrist=group(name+'_wrist');tool=group(name+'_tool')
 cube('Foot plate',(.76,.075,.72),(0,.04,0),steel,base);cube('Pedestal',(.53,1.04,.5),(0,.59,0),white,base,.035)
 for x in [-.245,.245]:cube('Column extrusion slot',(.012,.93,.012),(x,.59,.256),dark,base,.002)
 cube('Mount flange',(.72,.065,.65),(0,1.15,0),steel,base)
 for x in [-.29,.29]:
  for z in [-.26,.26]:cyl('Anchor bolt',.026,.024,(x,1.195,z),chrome,base,verts=6)
 cyl('J1 skirt',.275,.25,(0,1.31,0),paint,base);cyl('J1 turntable',.24,.14,(0,1.49,0),dark,base);cube('Shoulder gearbox',(.38,.3,.4),(0,1.65,0),paint,base,.06);cyl('Shoulder rotary cover',.205,.39,(0,1.8,0),paint,base,(0,0,1))
 if i==1:
  cyl('Silver upper tube',.115,1.02,(.56,0,0),steel,upper,(1,0,0));cyl('Elbow blue ring',.17,.35,(1.2,0,0),blue,upper,(0,0,1))
 else:
  cube('Cast upper arm',(.94,.24,.27),(.59,0,0),paint,upper,.065);cube('Arm side cover',(.63,.13,.016),(.6,0,.15),dark,upper,.025);cyl('Elbow casting',.205,.37,(1.2,0,0),paint,upper,(0,0,1))
 cyl('Elbow cap',.14,.4,(1.2,0,0),dark,upper,(0,0,1));cyl('Forearm tapered shell',.12,1.02,(.55,0,0),paint,fore,(1,0,0),.085);cube('Forearm cable housing',(.61,.07,.11),(.55,.115,0),dark,fore,.025);cyl('J4 motor',.135,.23,(1.04,0,0),dark,fore,(1,0,0));cyl('Wrist swivel',.12,.22,(0,0,0),paint,wrist,(0,0,1));cyl('J6 flange',.085,.075,(.055,0,0),chrome,tool,(1,0,0))
 for n in range(6):
  a=n*math.pi/3;cyl('Flange screw',.011,.012,(.1,.063*math.cos(a),.063*math.sin(a)),chrome,tool,(1,0,0),verts=6)
 if i==0:
  cyl('Vacuum adapter',.06,.13,(.13,0,0),steel,tool,(1,0,0));cube('Manifold plate',(.035,.38,.33),(.20,0,0),dark,tool,.018)
  for y in [-.135,.135]:
   for z in [-.11,.11]:
    cyl('Cup stem',.018,.07,(.25,y,z),chrome,tool,(1,0,0));cyl('Bellows cup',.023,.035,(.29,y,z),rubber,tool,(1,0,0),.038);cyl('Cup lip',.043,.014,(.313,y,z),rubber,tool,(1,0,0));cyl('Blue vacuum feed',.008,.13,(.13,y,z),blue,tool,(1,0,0))
 else:
  cube('Gripper actuator',(.17,.22,.2),(.16,0,0),dark,tool,.025);cube('Tool face',(.024,.25,.24),(.245,0,0),steel,tool,.008)
  for n in range(2 if i==1 else 3):
   jaw=group(name+('_jaw_'+('left' if n==0 else 'right') if i==1 else '_finger_'+str(n)),tool)
   cube('Gripper finger',(.10,.035,.07),(.30,0,0),chrome,jaw,.007);cube('Contact pad',(.065,.012,.06),(.322,-.018,0),rubber,jaw,.003)
 for part,L in [(upper,1.2),(fore,1.15)]:cyl('Cable sleeve',.022,L*.75,(L*.5,.15,.11),dark,part,(1,0,0))

# Recessed gearbox fasteners, service covers and pneumatic fittings.
for i,name in enumerate(['loader','capper','closer']):
 base=bpy.data.objects[name+'_base'];upper=bpy.data.objects[name+'_upper'];fore=bpy.data.objects[name+'_fore'];tool=bpy.data.objects[name+'_tool']
 for side in [-1,1]:
  cyl('Shoulder flange',.158,.016,(0,1.8,side*.203),steel,base,(0,0,1));cyl('Shoulder hub',.07,.02,(0,1.8,side*.215),dark,base,(0,0,1));cyl('Elbow flange',.135,.014,(1.2,0,side*.208),steel,upper,(0,0,1));cyl('Elbow hub',.054,.018,(1.2,0,side*.22),dark,upper,(0,0,1))
  for n in range(8):
   a=n*math.pi/4;cyl('Shoulder socket bolt',.012,.013,(.13*math.cos(a),1.8+.13*math.sin(a),side*.217),dark,base,(0,0,1),verts=6);cyl('Elbow socket bolt',.01,.013,(1.2+.109*math.cos(a),.109*math.sin(a),side*.223),dark,upper,(0,0,1),verts=6)
 for x in [.32,.47,.62,.77]:cube('Forearm service vent',(.065,.006,.07),(x,.152,0),steel,fore,.002)
 for x in [.3,.8]:
  for z in [-.04,.04]:cyl('Service cover screw',.007,.007,(x,.157,z),chrome,fore,verts=6)
 cube('Base service door',(.24,.28,.018),(0,.72,.26),steel,base,.012)
 for x in [-.09,.09]:
  for y in [.61,.83]:cyl('Door screw',.009,.012,(x,y,.276),dark,base,(0,0,1),verts=6)
 for z in [-.045,.045]:cyl('Air connector',.019,.04,(.135,.13,z),steel,tool,(0,1,0),verts=6);cyl('Air ferrule',.011,.022,(.135,.159,z),blue,tool,(0,1,0))

out=os.path.abspath('public/assets/cell-models.glb');bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_apply=True,export_yup=True);print('RAILSYN_ASSET',out,os.path.getsize(out))
