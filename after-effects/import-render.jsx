/* Run from After Effects > File > Scripts > Run Script File.
   Imports an already-rendered MP4, PNG, or PNG sequence. This does not create native VC Orb/GEOlayers controls. */
(function () {
  var file = File.openDialog('Pilih render Globe Kit: MP4 atau frame PNG pertama');
  if (!file) return;
  if (!app.project) app.newProject();
  app.beginUndoGroup('Import Globe Kit Render');
  try {
    var options = new ImportOptions(file);
    if (/\.png$/i.test(file.name) && confirm('Import sebagai PNG sequence? Pilih No untuk satu gambar.')) options.sequence = true;
    var footage = app.project.importFile(options);
    var fps = footage.frameRate > 0 ? footage.frameRate : 30;
    var duration = footage.duration > 0 ? footage.duration : 12;
    var comp = app.project.items.addComp('Globe Kit — ' + file.displayName, footage.width, footage.height, footage.pixelAspect, duration, fps);
    comp.layers.add(footage);
    comp.openInViewer();
  } catch (e) { alert('Render gagal diimpor: ' + e.toString()); }
  finally { app.endUndoGroup(); }
})();
