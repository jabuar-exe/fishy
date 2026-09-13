"""Offline final-image boundary checks. No model/network entry point is invoked."""
import hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'blender'))
from generate_scene import transport_images,GenerationError
class TransportChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.run=self.root/'run';(self.run/'inputs').mkdir(parents=True)
  self.data=b'\x89PNG\r\n\x1a\nfixture-data';self.hash=hashlib.sha256(self.data).hexdigest();(self.run/'inputs/photo.png').write_bytes(self.data)
  self.record={'path':'inputs/photo.png','role':'reference','sha256':self.hash,'mime':'image/png','bytes':len(self.data)}
 def tearDown(self):self.tmp.cleanup()
 def policy(self,allowed=None,forbidden=None):
  (self.run/'transport-policy.json').write_text(json.dumps({'allowedReconstructionHashes':allowed or [],'forbiddenHashes':forbidden or []}))
 def test_registered_reference_allowed(self):
  self.policy([self.hash]);self.assertEqual(transport_images(self.run,[self.record])[0][1],self.data)
 def test_heldout_hash_alias_denied(self):
  self.policy([self.hash],[self.hash]);(self.run/'inputs/renamed.png').write_bytes(self.data)
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'path':'inputs/renamed.png'}])
 def test_heldout_disguised_previous_render_denied(self):
  self.policy([], [self.hash])
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'role':'previous_render'}])
 def test_unregistered_reconstruction_denied(self):
  self.policy(['a'*64]);
  with self.assertRaises(GenerationError):transport_images(self.run,[self.record])
 def test_changed_registration_denied(self):
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'sha256':'a'*64}])
 def test_symlink_escape_denied(self):
  (self.root/'outside.png').write_bytes(self.data);(self.run/'inputs/alias.png').symlink_to(self.root/'outside.png')
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'path':'inputs/alias.png'}])
 def test_data_url_not_fetched(self):
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'path':'data:image/png;base64,abc'}])
 def test_heldout_role_denied(self):
  with self.assertRaises(GenerationError):transport_images(self.run,[{**self.record,'role':'heldout'}])
if __name__=='__main__':unittest.main()
