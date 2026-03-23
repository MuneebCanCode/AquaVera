// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AquaVeraEscrow
 * @notice Escrow contract for AquaVera WSC marketplace trades and credit retirement.
 * @dev Revenue split: 70% seller, 15% community, 5% verifier, 7% platform.
 *      Network fees (3%) are handled at the protocol level, not in this contract.
 */
contract AquaVeraEscrow {
    // ─── Events ──────────────────────────────────────────────────────────

    event TradeSettled(
        address indexed buyer,
        address indexed seller,
        uint256 wscAmount,
        uint256 totalPayment,
        string paymentToken
    );

    event CreditRetired(
        address indexed buyer,
        uint256 wscAmount,
        string purpose
    );

    // ─── State ───────────────────────────────────────────────────────────

    struct EscrowData {
        address buyer;
        address seller;
        uint256 wscAmount;
        uint256 totalPayment;
        bool active;
    }

    mapping(uint256 => EscrowData) public escrows;
    uint256 public escrowCount;

    // Revenue split percentages (out of 100)
    // Network fees (3%) are handled at the Hedera protocol level
    // The contract distributes the escrowed amount: 70% + 15% + 5% + 7% = 97%
    // Remaining 3% stays as dust/rounding buffer assigned to platform
    uint256 public constant SELLER_PCT = 70;
    uint256 public constant COMMUNITY_PCT = 15;
    uint256 public constant VERIFIER_PCT = 5;
    uint256 public constant PLATFORM_PCT = 7;

    // ─── Functions ───────────────────────────────────────────────────────

    /// @notice Lock buyer payment in escrow
    function escrow(
        address seller,
        uint256 wscAmount,
        uint256 totalPayment
    ) external payable {
        require(msg.value >= totalPayment, "Insufficient payment");
        require(seller != address(0), "Invalid seller");
        require(wscAmount > 0, "WSC amount must be positive");

        escrows[escrowCount] = EscrowData({
            buyer: msg.sender,
            seller: seller,
            wscAmount: wscAmount,
            totalPayment: totalPayment,
            active: true
        });

        escrowCount++;
    }

    /// @notice Settle trade: distribute payment per revenue split
    function settle(
        address seller,
        address communityFund,
        address verifier,
        address platformTreasury
    ) external {
        // Find the most recent active escrow for this seller
        uint256 escrowId = escrowCount - 1;
        EscrowData storage data = escrows[escrowId];

        require(data.active, "Escrow not active");
        require(data.seller == seller, "Seller mismatch");

        uint256 total = data.totalPayment;
        uint256 sellerAmount = (total * SELLER_PCT) / 100;
        uint256 communityAmount = (total * COMMUNITY_PCT) / 100;
        uint256 verifierAmount = (total * VERIFIER_PCT) / 100;
        uint256 platformAmount = (total * PLATFORM_PCT) / 100;
        // Remaining dust (from rounding) goes to platform
        uint256 dust = total - sellerAmount - communityAmount - verifierAmount - platformAmount;
        platformAmount += dust;

        data.active = false;

        payable(seller).transfer(sellerAmount);
        payable(communityFund).transfer(communityAmount);
        payable(verifier).transfer(verifierAmount);
        payable(platformTreasury).transfer(platformAmount);

        emit TradeSettled(
            data.buyer,
            seller,
            data.wscAmount,
            total,
            "HBAR"
        );
    }

    /// @notice Accept payment for credit retirement
    function retire(
        uint256 wscAmount,
        string calldata purpose
    ) external {
        require(wscAmount > 0, "WSC amount must be positive");

        emit CreditRetired(msg.sender, wscAmount, purpose);
    }
}
