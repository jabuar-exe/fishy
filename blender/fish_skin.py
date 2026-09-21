"""Astra-authored continuous UV skin and fin patterns for small aquarium fish.

Original illustrative skins, not specimen photographs. Coordinates are shared
with the detailed tetra's tapered, scale-normal-mapped skeletal mesh.
"""
import math
import numpy as np
from build_natural_assets import basic_material, texture_node, save_image

def smooth(x):
    x=np.clip(x,0,1);return x*x*(3-2*x)

def skin_material(species,label):
    a,t=np.mgrid[0:math.tau:512j,0:1:1024j];h=np.sin(a);side=np.abs(np.cos(a));dorsal=np.maximum(h,0)
    base={'ember-tetra':(.72,.19,.035),'cardinal-tetra':(.46,.50,.44),'green-neon-tetra':(.30,.41,.35),'black-neon-tetra':(.47,.49,.43),'glowlight-tetra':(.52,.45,.36),'rummy-nose-tetra':(.57,.59,.51),'harlequin-rasbora':(.60,.28,.14),'chili-rasbora':(.62,.055,.025),'celestial-pearl-danio':(.055,.12,.16),'endler-livebearer':(.27,.39,.29)}[species]
    rgb=np.broadcast_to(base,(*t.shape,3)).copy()*(1-.77*dorsal[...,None])
    def paint(mask,color):
        nonlocal rgb
        mask=np.clip(mask,0,1)[...,None];rgb=rgb*(1-mask)+np.array(color)*mask
    def band(low,high,start=.1,end=.98):
        return smooth((h-low)/.07)*smooth((high-h)/.07)*smooth((t-start)/.03)*smooth((end-t)/.025)*smooth((side-.4)/.15)
    if species in ('cardinal-tetra','green-neon-tetra'):
        paint(band(-.88,.065,.13 if species=='cardinal-tetra' else .66),(.69,.016,.027) if species=='cardinal-tetra' else (.28,.038,.036))
        paint(band(.06,.41),(.015,.47,.77) if species=='cardinal-tetra' else (.025,.67,.48))
    elif species=='black-neon-tetra':
        paint(band(-.43,.13),(.012,.022,.021));paint(band(.12,.37),(.77,.77,.47))
    elif species=='glowlight-tetra':paint(band(-.08,.13,.06),(.89,.19,.035))
    elif species=='rummy-nose-tetra':paint(smooth((.255-t)/.10),(.73,.027,.038))
    elif species=='harlequin-rasbora':
        wedge=smooth((t-.42)/.05)*smooth((.96-t)/.03)*smooth(((.88-t)*1.55-np.abs(h+.06))/.075)*smooth((side-.36)/.1)
        paint(wedge,(.008,.013,.023))
    elif species=='chili-rasbora':
        paint(band(-.17,.14,.17,.89),(.015,.02,.022));paint(np.exp(-((t-.87)/.045)**2-((h+.03)/.21)**2)*side,(.006,.012,.015))
    elif species=='celestial-pearl-danio':
        spots=np.zeros_like(t)
        for row in range(4):
            for col in range(9):
                tc=.19+col*.078+(row%2)*.025;hc=-.61+row*.34
                spots=np.maximum(spots,smooth((1-((t-tc)/.019)**2-((h-hc)/.075)**2)*3))
        paint(spots*smooth((side-.5)/.12),(.85,.72,.39))
    elif species=='endler-livebearer':
        paint(band(-.12,.38,.22,.71),(.025,.68,.43))
        for tc,hc,sx,sy,c in [(.30,-.30,.09,.5,(.97,.23,.018)),(.49,.02,.055,.72,(.008,.018,.022)),(.67,.10,.08,.55,(.89,.20,.015)),(.83,0,.07,.45,(.015,.12,.09))]:
            paint(smooth((1-((t-tc)/sx)**2-((h-hc)/sy)**2)*4)*side,c)
    # Staggered scales with directionally coherent tiny edges, not coarse noise.
    scales=np.cos(t*math.tau*55+np.floor(a/math.tau*29)%2*math.pi)*np.sin(a*29)**8
    rgb+=scales[...,None]*.016+np.random.default_rng(222).uniform(-.007,.007,(*t.shape,1))
    material=basic_material(label+' · continuous skin, scales and lateral pattern',(1,1,1),.31,.22)
    texture_node(material,save_image(species+'-skin-albedo',rgb),'Base Color')
    dy,dx=np.gradient(scales*.028);normal=np.stack([-dx,-dy,np.ones_like(t)],axis=2);normal/=np.linalg.norm(normal,axis=2)[...,None]
    texture_node(material,save_image(species+'-skin-normal',normal*.5+.5,True),'Normal',True)
    return material

def fin_material(species,label):
    v,u=np.mgrid[0:1:256j,0:1:512j];rgb=np.broadcast_to((.40,.48,.37),(*u.shape,3)).copy();alpha=.42
    if species in ('ember-tetra','harlequin-rasbora','chili-rasbora'):rgb[:]=(.62,.18,.04)
    elif species=='rummy-nose-tetra':
        # Three dark horizontal bars across the vertical caudal fan.
        bands=(np.abs(v-.5)<.07)|((v>.66)&(v<.75))|((v>.25)&(v<.34))
        rgb[:]=(.77,.81,.70);rgb[(u>.75)&bands]=(.008,.015,.018);alpha=.76
    elif species=='celestial-pearl-danio':
        rgb[:]=(.69,.09,.027);rgb[(np.abs(v-.5)>.21)&(np.abs(v-.5)<.29)]=(.012,.025,.025);alpha=.65
    elif species=='endler-livebearer':
        rgb[:]=(.40,.48,.36);rgb[(u>.78)&(np.abs(v-.5)>.12)]=(.96,.21,.012);rgb[(u>.82)&(np.abs(v-.5)>.22)]=(.008,.018,.02);alpha=.62
    material=basic_material(label+' · translucent rayed fin',(1,1,1),.4)
    texture_node(material,save_image(species+'-fin-albedo',rgb),'Base Color')
    material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=alpha
    material.surface_render_method='DITHERED';material.use_backface_culling=False
    return material
