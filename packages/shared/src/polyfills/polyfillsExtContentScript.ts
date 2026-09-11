// Install missing global aliases without modifying shared intrinsics.
// The protected MV3 runtime has already frozen Function.prototype here.
import './globalShim';
