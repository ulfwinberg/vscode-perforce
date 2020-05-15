import { expect } from "chai";

import * as vscode from "vscode";
import * as path from "path";

import * as PerforceUri from "../../PerforceUri";

describe("Perforce Uris", () => {
    const depotPath = "//depot/my/path/file.txt";
    const localUri = vscode.Uri.file("/home/file.txt");
    const workspaceArg =
        "workspace=" + encodeURIComponent(path.sep + "home" + path.sep + "file.txt");

    describe("Encode query", () => {
        it("Produces an encoded query string", () => {
            const query = PerforceUri.encodeQuery({
                command: "p&r=int",
                p4Args: "-q",
                depot: true,
                leftUri: undefined,
            });
            expect(query).to.equal("command=p%26r%3Dint&p4Args=-q&depot");
        });
    });
    describe("Decode query", () => {
        it("Decodes an encoded query string to an object", () => {
            const query = "command=p%26r%3Dint&p4Args=-q&depot";

            const decoded = PerforceUri.decodeUriQuery(query);
            expect(decoded).to.deep.equal({
                p4Args: "-q",
                command: "p&r=int",
                depot: true,
            });
        });
    });
    describe("fromUri", () => {
        it("Makes a URI with a default command", () => {
            const uri = PerforceUri.fromUri(localUri);
            expect(uri.scheme).to.equal("perforce");
            expect(uri.fsPath).to.equal(localUri.fsPath);
            expect(uri.query).to.equal("command=print&p4Args=-q");
        });
        it("Accepts additional arguments that can override the defaults", () => {
            const uri = PerforceUri.fromUri(localUri, {
                command: "opened",
                p4Args: undefined,
            });
            expect(uri.scheme).to.equal("perforce");
            expect(uri.fsPath).to.equal(localUri.fsPath);
            expect(uri.query).to.equal("command=opened");
        });
    });
    describe("forCommand", () => {
        it("Produces a URI for an arbitrary command", () => {
            const uri = PerforceUri.forCommand(localUri, "set", "-q");
            expect(uri.scheme).to.equal("perforce");
            expect(uri.fsPath).to.equal("");
            expect(uri.query).to.equal("command=set&p4Args=-q&" + workspaceArg);
        });
    });
    describe("fromDepotPath", () => {
        it("Produces a URI for a depot path, including the depot parameter", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            expect(uri.scheme).to.equal("perforce");
            expect(uri.authority).to.equal("depot");
            expect(uri.path).to.equal("/my/path/file.txt#2");
            expect(uri.query).to.equal(
                "command=print&p4Args=-q&depot&" + workspaceArg + "&depotName=depot&rev=2"
            );
            expect(uri.fragment).to.equal("2");
        });
        it("Has an optional revision", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, undefined);
            expect(uri.scheme).to.equal("perforce");
            expect(uri.authority).to.equal("depot");
            expect(uri.path).to.equal("/my/path/file.txt");
            expect(uri.query).to.equal(
                "command=print&p4Args=-q&depot&" + workspaceArg + "&depotName=depot"
            );
            expect(uri.fragment).to.equal("");
        });
    });
    describe("fromUriWithRevision", () => {
        it("Produces a perforce URI with an added revision / label fragment", () => {
            const uri = PerforceUri.fromUriWithRevision(localUri, "@=99");
            expect(uri.scheme).to.equal("perforce");
            expect(uri.fsPath).to.equal(localUri.fsPath + "@=99");
            expect(uri.query).to.equal("command=print&p4Args=-q&rev=%40%3D99");
            expect(uri.fragment).to.equal("@=99");
        });
    });
    describe("withArgs", () => {
        it("Augments existing query arguments", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            const left = PerforceUri.fromUriWithRevision(localUri, "1");
            const augmented = PerforceUri.withArgs(uri, { leftUri: left.toString() });
            expect(augmented.query).to.equal(
                "command=print&p4Args=-q&depot&" +
                    workspaceArg +
                    "&depotName=depot&rev=2" +
                    "&leftUri=" +
                    encodeURIComponent(left.toString())
            );
        });
        it("Overrides existing query arguments", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            const augmented = PerforceUri.withArgs(uri, { p4Args: "hello" });
            expect(augmented.query).to.equal(
                "command=print&p4Args=hello&depot&" +
                    workspaceArg +
                    "&depotName=depot&rev=2"
            );
        });
        it("Accepts an optional revision", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            const augmented = PerforceUri.withArgs(uri, { p4Args: "hello" }, "3");
            expect(augmented.query).to.equal(
                "command=print&p4Args=hello&depot&" +
                    workspaceArg +
                    "&depotName=depot&rev=3"
            );
            expect(augmented.fragment).to.equal("3");
        });
        it("Does not override the fragment if no revision supplied", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            const augmented = PerforceUri.withArgs(uri, { p4Args: "hello" });
            expect(augmented.query).to.equal(
                "command=print&p4Args=hello&depot&" +
                    workspaceArg +
                    "&depotName=depot&rev=2"
            );
            expect(augmented.fragment).to.equal("2");
        });
    });
    describe("isDepotUri", () => {
        it("Returns true for depot URIs with the depot flag", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, undefined);
            expect(PerforceUri.isDepotUri(uri)).to.be.true;
        });
        it("Returns false for normal URIs", () => {
            expect(PerforceUri.isDepotUri(localUri)).to.be.false;
        });
        it("Returns false for perforce URIs without the depot flag", () => {
            const uri = PerforceUri.fromUri(localUri);
            expect(PerforceUri.isDepotUri(uri)).to.be.false;
        });
    });
    describe("isUsableForWorkspace", () => {
        it("Returns true for local files", () => {
            expect(PerforceUri.isUsableForWorkspace(localUri)).to.be.true;
        });
        it("Returns false for depot URIs without a workspace", () => {
            const uri = PerforceUri.fromUri(vscode.Uri.parse("perforce://depot/hello"), {
                depot: true,
            });
            expect(PerforceUri.isUsableForWorkspace(uri)).to.be.false;
        });
        it("Returns true for depot URIs with a workspace argument", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            expect(PerforceUri.isUsableForWorkspace(uri)).to.be.true;
        });
    });
    describe("getWorkspaceFromQuery", () => {
        it("Gets the workspace param from a depot URI", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            expect(PerforceUri.getWorkspaceFromQuery(uri)).to.deep.equal(
                vscode.Uri.file(localUri.fsPath)
            );
        });
        it("Is undefined if there is no workspace", () => {
            const uri = PerforceUri.fromUri(vscode.Uri.parse("perforce://depot/hello"), {
                depot: true,
            });
            expect(PerforceUri.getWorkspaceFromQuery(uri)).to.be.undefined;
        });
    });
    describe("getUsableWorkspace", () => {
        it("Returns a URI of the fs path for non-depot URIs", () => {
            const uri = PerforceUri.fromUri(localUri);
            expect(PerforceUri.getUsableWorkspace(uri)).to.deep.equal(
                vscode.Uri.file(localUri.fsPath)
            );
        });
        it("Returns the workspace param from a depot URI", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            expect(PerforceUri.getUsableWorkspace(uri)).to.deep.equal(
                vscode.Uri.file(localUri.fsPath)
            );
        });
    });
    describe("getDepotPathFromDepotUri", () => {
        it("Can determine a valid path from a Uri", () => {
            const depotUri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            expect(PerforceUri.getDepotPathFromDepotUri(depotUri)).to.be.equal(depotPath);
        });
        it("Uses correct case for the depot name", () => {
            const path = "//DepOt/myFile";
            const depotUri = PerforceUri.fromDepotPath(localUri, path, "2");
            expect(PerforceUri.getDepotPathFromDepotUri(depotUri)).to.be.equal(path);
        });
    });
    describe("parse", () => {
        it("Parses a URI with an embedded revision", () => {
            const uri = PerforceUri.parse("perforce://depot/a/myFile#2?a=b#2");
            expect(uri.authority).to.equal("depot");
            expect(uri.fragment).to.equal("2");
            expect(uri.query).to.equal("a=b");
            expect(uri.path).to.equal("/a/myFile#2");
        });
        it("Handles an embedded revision without an actual fragment", () => {
            const uri = PerforceUri.parse("perforce://depot/a/myFile#2?a=b");
            expect(uri.authority).to.equal("depot");
            expect(uri.fragment).to.equal("");
            expect(uri.query).to.equal("a=b");
            expect(uri.path).to.equal("/a/myFile#2");
        });
        it("Handles an embedded revision without a query", () => {
            const uri = PerforceUri.parse("perforce://depot/a/myFile#2#2");
            expect(uri.authority).to.equal("depot");
            expect(uri.fragment).to.equal("2");
            expect(uri.query).to.equal("");
            expect(uri.path).to.equal("/a/myFile#2");
        });
        it("Parses a file without a query string or fragment normally", () => {
            const uri = PerforceUri.parse("perforce://depot/a/myFile#2");
            expect(uri.authority).to.equal("depot");
            expect(uri.fragment).to.equal("2");
            expect(uri.query).to.equal("");
            expect(uri.path).to.equal("/a/myFile");
        });
    });
    describe("withoutRev", () => {
        it("Removes a revision from a path if it matches the fragment", () => {
            const path = "/my/path#2";
            expect(PerforceUri.withoutRev(path, "2")).to.equal("/my/path");
        });
        it("Handles labels", () => {
            const path = "/my/path@=99";
            expect(PerforceUri.withoutRev(path, "@=99")).to.equal("/my/path");
        });
        it("Does not remove different values", () => {
            const path = "/my/path#2";
            expect(PerforceUri.withoutRev(path, "3")).to.equal("/my/path#2");
        });
    });
    describe("fsPathWithoutRev", () => {
        it("Removes a revision from a path if it matches the fragment", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2");
            const withoutRev = PerforceUri.fsPathWithoutRev(uri);
            expect(withoutRev).to.equal(path.sep + path.join("my", "path", "file.txt"));
        });
        it("Handles labels", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "@=99");
            const withoutRev = PerforceUri.fsPathWithoutRev(uri);
            expect(withoutRev).to.equal(path.sep + path.join("my", "path", "file.txt"));
        });
        it("Does not remove non-matching parts", () => {
            const uri = PerforceUri.fromDepotPath(localUri, depotPath, "2").with({
                fragment: "3",
            });
            const withoutRev = PerforceUri.fsPathWithoutRev(uri);
            expect(withoutRev).to.equal(uri.fsPath);
        });
    });
});
