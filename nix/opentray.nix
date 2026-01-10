{
  lib,
  stdenv,
  rustPlatform,
  nodejs_20,
  nodePackages,
  pkg-config,
  openssl,
  dbus ? null,
  glib ? null,
  gtk3 ? null,
  libsoup_3 ? null,
  webkitgtk_4_1 ? null,
  librsvg ? null,
  libappindicator-gtk3 ? null,
  darwin ? null,
  makeBinaryWrapper,
  version,
  src,
}:

rustPlatform.buildRustPackage rec {
  pname = "opentray";
  inherit version src;

  # Cargo workspace is in src-tauri
  sourceRoot = "${src.name}/src-tauri";
  
  cargoLock = {
    lockFile = ../src-tauri/Cargo.lock;
    allowBuiltinFetchGit = true;
  };

  nativeBuildInputs = [
    pkg-config
    nodejs_20
    nodePackages.npm
    makeBinaryWrapper
  ];

  buildInputs = [
    openssl
  ] ++ lib.optionals stdenv.isLinux [
    dbus
    glib
    gtk3
    libsoup_3
    webkitgtk_4_1
    librsvg
    libappindicator-gtk3
  ] ++ lib.optionals stdenv.isDarwin [
    darwin.apple_sdk.frameworks.AppKit
    darwin.apple_sdk.frameworks.WebKit
    darwin.apple_sdk.frameworks.Security
    darwin.apple_sdk.frameworks.CoreServices
  ];

  preBuild = ''
    # Go to root and build frontend
    pushd ..
    
    # Install npm dependencies
    npm ci --ignore-scripts
    
    # Build the frontend
    npm run build
    
    popd
  '';

  postInstall = lib.optionalString stdenv.isLinux ''
    # Wrap the binary to ensure it finds the libraries
    wrapProgram $out/bin/opentray \
      --prefix LD_LIBRARY_PATH : ${
        lib.makeLibraryPath [
          gtk3
          webkitgtk_4_1
          librsvg
          glib
          libsoup_3
        ]
      }
  '';

  meta = with lib; {
    description = "Menubar companion app for OpenCode";
    homepage = "https://github.com/crhistian-cornejo/OpenTray";
    license = licenses.mit;
    maintainers = [ ];
    mainProgram = "opentray";
    platforms = platforms.linux ++ platforms.darwin;
  };
}
