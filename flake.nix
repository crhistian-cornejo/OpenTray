{
  description = "OpenTray - Menubar companion for OpenCode";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Read version from package.json
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        version = packageJson.version;
        
        # Platform-specific dependencies
        linuxBuildInputs = with pkgs; [
          dbus
          glib
          gtk3
          libsoup_3
          webkitgtk_4_1
          librsvg
          libappindicator-gtk3
        ];
        
        darwinBuildInputs = with pkgs; [
          darwin.apple_sdk.frameworks.AppKit
          darwin.apple_sdk.frameworks.WebKit
          darwin.apple_sdk.frameworks.Security
          darwin.apple_sdk.frameworks.CoreServices
        ];
      in
      {
        # Development shell
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Node.js and package managers
            nodejs_20
            nodePackages.npm
            
            # Rust toolchain
            rustc
            cargo
            rustfmt
            clippy
            
            # Build tools
            pkg-config
            openssl
            
            # Tauri CLI
            cargo-tauri
          ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux linuxBuildInputs
            ++ pkgs.lib.optionals pkgs.stdenv.isDarwin darwinBuildInputs;
          
          shellHook = ''
            echo "OpenTray development environment"
            echo "Run 'npm install' then 'npm run tauri dev' to start"
          '';
        };

        # Package build
        packages.default = pkgs.callPackage ./nix/opentray.nix {
          inherit version;
          src = ./.;
        };
        
        # App for running in dev mode
        apps.dev = {
          type = "app";
          program = toString (pkgs.writeShellScript "opentray-dev" ''
            cd ${./.}
            ${pkgs.nodejs_20}/bin/npm run tauri dev
          '');
        };
      }
    );
}
