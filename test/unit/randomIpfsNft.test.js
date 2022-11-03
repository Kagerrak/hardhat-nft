const { assert, expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Random IPFS NFT Unit Tests", async () => {
      let randomIpfsNft, deployer, vrfCoordinatorV2Mock;

      beforeEach(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await deployments.fixture(["mocks", "randomipfs"]);
        randomIpfsNft = await ethers.getContract("RandomIpfsNft");
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
      });

      describe("constructor", () => {
        it("sets starting values correctly", async () => {
          const dogTokenUriZero = await randomIpfsNft.getDogTokenUris(0);
          assert(dogTokenUriZero.includes("ipfs://"));
        });
      });

      describe("requestNft", () => {
        it("fails if payment isnt sent with the request", async () => {
          await expect(randomIpfsNft.requestNft()).to.be.revertedWith(
            "RandomIpfsNft__NeedMoreETHSent"
          );
        });
        it("reverts if payment is less than the mint fee", async () => {
          const fee = await randomIpfsNft.getMintFee();
          await expect(
            randomIpfsNft.requestNft({
              value: fee.sub(ethers.utils.parseEther("0.001")),
            })
          ).to.be.revertedWith("RandomIpfsNft__NeedMoreETHSent");
        });
        it("emits an event and kicks off a random word request", async () => {
          const fee = await randomIpfsNft.getMintFee();
          await expect(
            randomIpfsNft.requestNft({ value: fee.toString() })
          ).to.emit(randomIpfsNft, "NftRequested");
        });
      });

      describe("fulfillRandomWords", () => {
        it("mints NFT after random number is returned", async function () {
          await new Promise(async (resolve, reject) => {
            console.log("Setting up Listener...");
            randomIpfsNft.once("NftMinted", async () => {
              console.log("Found the event!");
              try {
                const tokenUri = await randomIpfsNft.tokenURI("0");
                const tokenCounter = await randomIpfsNft.getTokenCounter();
                assert.equal(tokenUri.toString().includes("ipfs://"), true);
                assert.equal(tokenCounter.toString(), "1");
                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
            try {
              const fee = await randomIpfsNft.getMintFee();
              console.log("Requesting to mint NFT...");
              const requestNftResponse = await randomIpfsNft.requestNft({
                value: fee.toString(),
              });
              console.log("Requested minting NFT...");
              const requestNftReceipt = await requestNftResponse.wait(1);
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                requestNftReceipt.events[1].args.requestId,
                randomIpfsNft.address
              );
              console.log("NFT minted emitted the event");
            } catch (e) {
              console.log(e);
              reject(e);
            }
          });
        });
      });
      describe("getBreedFromModdedRng", () => {
        it("should return pug ig moddedRng < 10", async () => {
          const expectedValue = await randomIpfsNft.getBreedFromModdedRng(8);
          assert.equal(0, expectedValue);
        });
        it("should return shiba inu if moddedRng is bw 10 - 39", async () => {
          const expectedValue = await randomIpfsNft.getBreedFromModdedRng(39);
          assert.equal(1, expectedValue);
        });
        it("should return st bernard ig moddedRng > 39", async () => {
          const expectedValue = await randomIpfsNft.getBreedFromModdedRng(40);
          assert.equal(2, expectedValue);
        });
      });
    });
